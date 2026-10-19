// backend/scripts/rebuildProductMovementsBalance.js
// Rebuilds stock_before/stock_after using the complete movement ledger,
// authoritative NF-e dates, and productsStock.stock_qty as the final anchor.

//node --env-file=.env.local scripts/rebuildProductMovementsBalance.js --product-code=011001
//node --env-file=.env.local scripts/rebuildProductMovementsBalance.js --product-code=011001 --apply

// node --env-file=.env.local scripts/rebuildProductMovementsBalance.js
// node --env-file=.env.local scripts/rebuildProductMovementsBalance.js --apply

'use strict';

import 'dotenv/config';
import pool from '../config/db.js';

const MOVEMENTS_TABLE = 'productMovements';
const STOCK_TABLE = 'productsStock';

const INBOUND_TYPES = Object.freeze([
  'INBOUND',
  'ENTRADA',
  'IN',
  'STOCK_IN',
  'PURCHASE',
  'PURCHASE_INBOUND',
  'ADJUSTMENT_IN',
]);

const OUTBOUND_TYPES = Object.freeze([
  'OUTBOUND',
  'SAIDA',
  'SAÍDA',
  'OUT',
  'STOCK_OUT',
  'SALE',
  'SALES',
  'ADJUSTMENT_OUT',
]);

const SIGNED_TYPES = Object.freeze([
  'ADJUSTMENT',
  'AJUSTE',
  'INVENTORY',
  'INVENTARIO',
  'INVENTÁRIO',
  'OPENING_BALANCE',
  'SALDO_INICIAL',
]);

function readArgs() {
  const apply = process.argv.includes('--apply');
  const productArg = process.argv.find((arg) => arg.startsWith('--product-code='));
  const productCode = productArg ? productArg.slice('--product-code='.length).trim() : null;
  if (productArg && !productCode) throw new Error('--product-code cannot be empty.');
  return { apply, productCode };
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function getColumns(client, tableName) {
  const { rows } = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1`,
    [tableName],
  );
  return new Set(rows.map((row) => row.column_name));
}

function requireColumns(columns, tableName, required) {
  const missing = required.filter((column) => !columns.has(column));
  if (missing.length) {
    throw new Error(`${tableName} is missing required column(s): ${missing.join(', ')}`);
  }
}

function resolveBalanceColumns(columns) {
  const candidates = [
    ['stock_before', 'stock_after'],
    ['previous_stock', 'new_stock'],
    ['before_stock', 'after_stock'],
  ];
  const pair = candidates.find(([before, after]) => columns.has(before) && columns.has(after));
  if (!pair) {
    throw new Error(
      `${MOVEMENTS_TABLE} needs stock_before/stock_after, previous_stock/new_stock, or before_stock/after_stock.`,
    );
  }
  return { beforeColumn: pair[0], afterColumn: pair[1] };
}

async function validateMovementTypes(client, productCode) {
  const knownTypes = [...INBOUND_TYPES, ...OUTBOUND_TYPES, ...SIGNED_TYPES];
  const params = [knownTypes];
  const productFilter = productCode === null ? '' : `AND product_code = $${params.push(productCode)}`;
  const { rows } = await client.query(
    `SELECT upper(btrim(movement_type)) AS movement_type,
            count(*)::integer AS rows
       FROM public.${quoteIdentifier(MOVEMENTS_TABLE)}
      WHERE NOT (upper(btrim(movement_type)) = ANY($1::text[]))
        ${productFilter}
      GROUP BY upper(btrim(movement_type))
      ORDER BY movement_type`,
    params,
  );
  if (rows.length) {
    throw new Error(`Unknown movement type(s): ${rows.map((row) => `${row.movement_type} (${row.rows})`).join(', ')}`);
  }
}

async function validateStockAnchors(client, productCode) {
  const params = [];
  const productFilter = productCode === null ? '' : `AND pm.product_code = $${params.push(productCode)}`;
  const { rows } = await client.query(
    `SELECT DISTINCT pm.product_code
       FROM public.${quoteIdentifier(MOVEMENTS_TABLE)} pm
      WHERE NOT EXISTS (
              SELECT 1
                FROM public.products p
                JOIN public.${quoteIdentifier(STOCK_TABLE)} ps
                  ON ps.product_stock_id = p.product_stock_id
               WHERE p.product_code = pm.product_code
            )
        ${productFilter}
      ORDER BY pm.product_code
      LIMIT 20`,
    params,
  );
  if (rows.length) {
    throw new Error(`Products without productsStock anchor: ${rows.map((row) => row.product_code).join(', ')}`);
  }
}

async function createCalculation(client, options) {
  const params = [INBOUND_TYPES, OUTBOUND_TYPES, SIGNED_TYPES];
  const productFilter = options.productCode === null
    ? ''
    : `AND pm.product_code = $${params.push(options.productCode)}`;

  await client.query('DROP TABLE IF EXISTS pg_temp.rebuilt_movement_balances');
  await client.query(
    `CREATE TEMP TABLE rebuilt_movement_balances ON COMMIT DROP AS
     WITH current_stock AS (
       SELECT p.product_code,
              max(COALESCE(ps.stock_qty, 0))::numeric AS current_stock
         FROM public.products p
         JOIN public.${quoteIdentifier(STOCK_TABLE)} ps
           ON ps.product_stock_id = p.product_stock_id
        GROUP BY p.product_code
     ),
     normalized AS (
       SELECT pm.movement_id,
              pm.product_code,
              upper(btrim(pm.movement_type)) AS movement_type,
              COALESCE(pm.quantity, 0)::numeric AS quantity,
              CASE
                WHEN upper(btrim(pm.movement_type)) = ANY($1::text[])
                  THEN abs(COALESCE(pm.quantity, 0))
                WHEN upper(btrim(pm.movement_type)) = ANY($2::text[])
                  THEN -abs(COALESCE(pm.quantity, 0))
                WHEN upper(btrim(pm.movement_type)) = ANY($3::text[])
                  THEN COALESCE(pm.quantity, 0)
              END::numeric AS signed_quantity,
              COALESCE(
                CASE
                  WHEN pm.origin_module = 'INBOUND_INVOICE'
                    THEN COALESCE(inv.entry_date::timestamp, inv.issue_date::timestamp, inv.created_at)
                  WHEN pm.origin_module = 'ORDER_NFE_ATTEMPT'
                    THEN COALESCE(order_attempt.authorized_at, order_attempt.requested_at)
                  WHEN pm.origin_module = 'BUDGET_NFE_ATTEMPT'
                    THEN COALESCE(budget_attempt.authorized_at, budget_attempt.requested_at)
                END,
                pm.created_at,
                timestamp '1970-01-01 00:00:00'
              ) AS occurred_at,
              CASE
                WHEN upper(btrim(pm.movement_type)) = ANY($1::text[]) THEN 1
                WHEN upper(btrim(pm.movement_type)) = ANY($2::text[]) THEN 2
                ELSE 3
              END AS type_order
         FROM public.${quoteIdentifier(MOVEMENTS_TABLE)} pm
         LEFT JOIN public."inboundInvoices" inv
           ON pm.origin_module = 'INBOUND_INVOICE'
          AND pm.origin_id::text = inv.id::text
         LEFT JOIN LATERAL (
           SELECT a.authorized_at, a.requested_at
             FROM public."ordersNfeAttempts" a
            WHERE pm.origin_module = 'ORDER_NFE_ATTEMPT'
              AND a.invoice_id::text = pm.origin_id::text
            ORDER BY a.authorized_at DESC NULLS LAST, a.attempt_id DESC
            LIMIT 1
         ) order_attempt ON true
         LEFT JOIN LATERAL (
           SELECT a.authorized_at, a.requested_at
             FROM public."budgetsNfeAttempts" a
            WHERE pm.origin_module = 'BUDGET_NFE_ATTEMPT'
              AND a.invoice_id::text = pm.origin_id::text
            ORDER BY a.authorized_at DESC NULLS LAST, a.attempt_id DESC
            LIMIT 1
         ) budget_attempt ON true
        WHERE true
          ${productFilter}
     ),
     totals AS (
       SELECT n.*,
              cs.current_stock,
              sum(n.signed_quantity) OVER (
                PARTITION BY n.product_code
              ) AS total_movement,
              sum(n.signed_quantity) OVER (
                PARTITION BY n.product_code
                ORDER BY n.occurred_at, n.type_order, n.movement_id
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ) AS movement_before,
              sum(n.signed_quantity) OVER (
                PARTITION BY n.product_code
                ORDER BY n.occurred_at, n.type_order, n.movement_id
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS movement_after
         FROM normalized n
         JOIN current_stock cs
           ON cs.product_code = n.product_code
     )
     SELECT movement_id,
            product_code,
            movement_type,
            quantity,
            signed_quantity,
            occurred_at,
            type_order,
            current_stock,
            current_stock - total_movement
              + COALESCE(movement_before, 0) AS calculated_before,
            current_stock - total_movement
              + movement_after AS calculated_after
       FROM totals`,
    params,
  );
}

async function getSummary(client, beforeColumn, afterColumn) {
  const { rows } = await client.query(
    `SELECT count(*)::integer AS movements,
            count(DISTINCT calc.product_code)::integer AS products,
            count(*) FILTER (
              WHERE pm.${quoteIdentifier(beforeColumn)} IS DISTINCT FROM calc.calculated_before
                 OR pm.${quoteIdentifier(afterColumn)} IS DISTINCT FROM calc.calculated_after
            )::integer AS rows_to_update,
            count(*) FILTER (WHERE calc.calculated_after < 0)::integer AS negative_balance_rows,
            min(calc.calculated_after) AS minimum_balance
       FROM rebuilt_movement_balances calc
       JOIN public.${quoteIdentifier(MOVEMENTS_TABLE)} pm
         ON pm.movement_id = calc.movement_id`,
  );
  return rows[0];
}

async function applyBalances(client, beforeColumn, afterColumn) {
  const result = await client.query(
    `UPDATE public.${quoteIdentifier(MOVEMENTS_TABLE)} pm
        SET ${quoteIdentifier(beforeColumn)} = calc.calculated_before,
            ${quoteIdentifier(afterColumn)} = calc.calculated_after
       FROM rebuilt_movement_balances calc
      WHERE pm.movement_id = calc.movement_id
        AND (
          pm.${quoteIdentifier(beforeColumn)} IS DISTINCT FROM calc.calculated_before
          OR pm.${quoteIdentifier(afterColumn)} IS DISTINCT FROM calc.calculated_after
        )`,
  );
  return result.rowCount;
}

async function validateFinalBalances(client) {
  const { rows } = await client.query(
    `WITH last_rows AS (
       SELECT DISTINCT ON (product_code)
              product_code,
              current_stock,
              calculated_after
         FROM rebuilt_movement_balances
        ORDER BY product_code, occurred_at DESC, type_order DESC, movement_id DESC
     )
     SELECT product_code, current_stock, calculated_after
       FROM last_rows
      WHERE abs(current_stock - calculated_after) > 0.000001
      LIMIT 20`,
  );
  if (rows.length) {
    throw new Error(`Final balance validation failed: ${JSON.stringify(rows)}`);
  }
}

async function main() {
  const options = readArgs();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      'rebuild_product_movements_balance',
    ]);

    const [movementColumns, stockColumns, productColumns] = await Promise.all([
      getColumns(client, MOVEMENTS_TABLE),
      getColumns(client, STOCK_TABLE),
      getColumns(client, 'products'),
    ]);

    requireColumns(movementColumns, MOVEMENTS_TABLE, [
      'movement_id', 'product_code', 'movement_type', 'quantity',
      'origin_module', 'origin_id', 'created_at',
    ]);
    requireColumns(stockColumns, STOCK_TABLE, ['product_stock_id', 'stock_qty']);
    requireColumns(productColumns, 'products', ['product_code', 'product_stock_id']);

    const { beforeColumn, afterColumn } = resolveBalanceColumns(movementColumns);
    await validateMovementTypes(client, options.productCode);
    await validateStockAnchors(client, options.productCode);
    await createCalculation(client, options);
    await validateFinalBalances(client);

    const summary = await getSummary(client, beforeColumn, afterColumn);
    console.log({
      mode: options.apply ? 'APPLY' : 'PREVIEW',
      productCode: options.productCode ?? 'ALL',
      balanceColumns: `${beforeColumn}/${afterColumn}`,
      ...summary,
    });

    const preview = await client.query(
      `SELECT movement_id, product_code, movement_type, quantity,
              occurred_at, calculated_before, calculated_after, current_stock
         FROM rebuilt_movement_balances
        ORDER BY product_code, occurred_at, movement_id
        LIMIT 30`,
    );
    console.table(preview.rows);

    if (!options.apply) {
      await client.query('ROLLBACK');
      console.log('Preview only. Run again with --apply to update the balance columns.');
      return;
    }

    const updated = await applyBalances(client, beforeColumn, afterColumn);
    await validateFinalBalances(client);
    await client.query('COMMIT');
    console.log({ ok: true, updated });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[rebuildProductMovementsBalance] ERROR:', error);
  process.exitCode = 1;
});

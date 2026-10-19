// backend/scripts/backFillProductMovementsFromBudgetsNfeAttempts.js
// Backfills OUTBOUND product movements exclusively from authorized budget NF-e attempts.

// node --env-file=.env.local scripts/backFillProductMovementsFromBudgetsNfeAttempts.js
// node --env-file=.env.local scripts/backFillProductMovementsFromBudgetsNfeAttempts.js --apply
'use strict';

import 'dotenv/config';
import pool from '../config/db.js';

const SOURCE = Object.freeze({
  attemptsTable: 'budgetsNfeAttempts',
  itemsTable: 'budgetsNfeAttemptItems',
  originModule: 'BUDGET_NFE_ATTEMPT',
  sourceType: 'BUDGET',
  label: 'budgets',
});

const TARGET_TABLE = 'productMovements';
const MAX_LIMIT = 50000;

function readArgs() {
  const apply = process.argv.includes('--apply');
  const rawLimit = process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1];
  const rawInvoiceId = process.argv.find((arg) => arg.startsWith('--invoice-id='))?.split('=')[1];
  const limit = rawLimit === undefined ? 1000 : Number(rawLimit);
  const invoiceId = rawInvoiceId === undefined ? null : Number(rawInvoiceId);

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`--limit must be an integer between 1 and ${MAX_LIMIT}.`);
  }
  if (invoiceId !== null && (!Number.isSafeInteger(invoiceId) || invoiceId < 1)) {
    throw new Error('--invoice-id must be a positive integer.');
  }
  return { apply, limit, invoiceId };
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function getTargetColumns(client) {
  const { rows } = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1`,
    [TARGET_TABLE],
  );
  const columns = new Set(rows.map((row) => row.column_name));
  const required = ['product_code', 'movement_type', 'quantity', 'origin_module', 'origin_id'];
  const missing = required.filter((column) => !columns.has(column));
  if (missing.length) {
    throw new Error(`${TARGET_TABLE} is missing required column(s): ${missing.join(', ')}`);
  }
  return columns;
}

async function loadSourceRows(client, { limit, invoiceId }) {
  const params = [limit];
  const invoiceFilter = invoiceId === null ? '' : `AND a.invoice_id = $${params.push(invoiceId)}`;
  const sql = `
    WITH selected_attempts AS (
      SELECT DISTINCT ON (a.invoice_id)
             a.attempt_id,
             a.invoice_id,
             a.nfe_number
        FROM public.${quoteIdentifier(SOURCE.attemptsTable)} a
       WHERE a.nfe_status_id = 3
         AND a.invoice_id IS NOT NULL
         ${invoiceFilter}
       ORDER BY a.invoice_id, a.attempt_id DESC
    )
    SELECT a.invoice_id,
           a.nfe_number,
           i.product_code,
           max(i.description) AS description,
           sum(i.quantity)::numeric AS quantity
      FROM selected_attempts a
      JOIN public.${quoteIdentifier(SOURCE.itemsTable)} i
        ON i.attempt_id = a.attempt_id
     WHERE i.product_code IS NOT NULL
       AND btrim(i.product_code) <> ''
       AND i.quantity > 0
     GROUP BY a.invoice_id, a.nfe_number, i.product_code
     ORDER BY a.nfe_number NULLS LAST, a.invoice_id, i.product_code
     LIMIT $1`;
  return (await client.query(sql, params)).rows;
}

function buildMovement(row, columns) {
  const values = new Map();
  const add = (column, value) => {
    if (columns.has(column) && !values.has(column)) values.set(column, value);
  };

  add('product_code', row.product_code);
  add('movement_type', 'OUTBOUND');
  add('quantity', row.quantity);
  add('origin_module', SOURCE.originModule);
  add('origin_id', row.invoice_id);
  add('invoice_id', row.invoice_id);
  add('nfe_number', row.nfe_number);
  add('invoice_number', row.nfe_number);
  add('reference_type', 'NFE');
  add('reference_id', row.invoice_id);
  add('source_type', SOURCE.sourceType);
  add('source_id', row.invoice_id);
  add('description', row.description);
  add('notes', `Backfill ${SOURCE.label} NF-e ${row.nfe_number ?? 'without number'}`);
  add('lot_id', null);
  add('lot_code', null);
  add('stock_before', null);
  add('stock_after', null);
  add('previous_stock', null);
  add('new_stock', null);
  return values;
}

async function alreadyExists(client, row) {
  const { rowCount } = await client.query(
    `SELECT 1
       FROM public.${quoteIdentifier(TARGET_TABLE)}
      WHERE origin_module = $1
        AND origin_id::text = $2
        AND product_code = $3
      LIMIT 1`,
    [SOURCE.originModule, String(row.invoice_id), row.product_code],
  );
  return rowCount > 0;
}

async function insertMovement(client, movement) {
  const entries = [...movement.entries()];
  const columnSql = entries.map(([column]) => quoteIdentifier(column)).join(', ');
  const placeholderSql = entries.map((_, index) => `$${index + 1}`).join(', ');
  await client.query(
    `INSERT INTO public.${quoteIdentifier(TARGET_TABLE)} (${columnSql}) VALUES (${placeholderSql})`,
    entries.map(([, value]) => value),
  );
}

async function main() {
  const options = readArgs();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      'backfill_product_movements_from_budget_nfe_attempts',
    ]);
    const columns = await getTargetColumns(client);
    const rows = await loadSourceRows(client, options);
    let existing = 0;
    let pending = 0;

    for (const row of rows) {
      if (await alreadyExists(client, row)) existing += 1;
      else pending += 1;
    }

    console.log({ mode: options.apply ? 'APPLY' : 'PREVIEW', sourceRows: rows.length, existing, pending });

    if (!options.apply) {
      console.table(rows.slice(0, 20));
      await client.query('ROLLBACK');
      console.log('Preview only. Run again with --apply to insert the pending movements.');
      return;
    }

    let inserted = 0;
    for (const row of rows) {
      if (await alreadyExists(client, row)) continue;
      await insertMovement(client, buildMovement(row, columns));
      inserted += 1;
    }
    await client.query('COMMIT');
    console.log({ ok: true, inserted, skipped: rows.length - inserted });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[backFillProductMovementsFromBudgetsNfeAttempts] ERROR:', error);
  process.exitCode = 1;
});

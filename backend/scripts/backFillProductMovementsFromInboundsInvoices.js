// backend/scripts/backFillProductMovementsFromInboundsInvoices.js
// Backfills INBOUND product movements exclusively from inboundInvoices/inboundInvoiceItems.

// node --env-file=.env.local scripts/backFillProductMovementsFromInboundsInvoices.js
// node --env-file=.env.local scripts/backFillProductMovementsFromInboundsInvoices.js --apply

'use strict';

import 'dotenv/config';
import pool from '../config/db.js';

const TARGET_TABLE = 'productMovements';
const ORIGIN_MODULE = 'INBOUND_INVOICE';
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
  const invoiceFilter = invoiceId === null ? '' : `AND inv.id = $${params.push(invoiceId)}`;

  const sql = `
    SELECT inv.id AS invoice_id,
           inv.invoice_number,
           btrim(inv.access_key::text) AS access_key,
           COALESCE(
             inv.entry_date::timestamp,
             inv.issue_date::timestamp,
             inv.created_at,
             now()
           ) AS movement_at,
           item.product_code,
           max(item.description) AS description,
           max(item.unit) AS unit_code,
           sum(item.quantity)::numeric AS quantity
      FROM public."inboundInvoices" inv
      JOIN public."inboundInvoiceItems" item
        ON item.invoice_id = inv.id
     WHERE inv.stock_applied = true
       AND item.product_code IS NOT NULL
       AND btrim(item.product_code) <> ''
       AND item.quantity > 0
       ${invoiceFilter}
     GROUP BY inv.id,
              inv.invoice_number,
              inv.access_key,
              inv.entry_date,
              inv.issue_date,
              inv.created_at,
              item.product_code
     ORDER BY movement_at, inv.id, item.product_code
     LIMIT $1`;

  return (await client.query(sql, params)).rows;
}

async function countUnmappedItems(client, invoiceId) {
  const params = [];
  const invoiceFilter = invoiceId === null ? '' : `AND inv.id = $${params.push(invoiceId)}`;
  const { rows } = await client.query(
    `SELECT count(*)::integer AS total
       FROM public."inboundInvoices" inv
       JOIN public."inboundInvoiceItems" item
         ON item.invoice_id = inv.id
      WHERE inv.stock_applied = true
        AND (item.product_code IS NULL OR btrim(item.product_code) = '')
        ${invoiceFilter}`,
    params,
  );
  return rows[0].total;
}

function buildMovement(row, columns) {
  const values = new Map();
  const add = (column, value) => {
    if (columns.has(column) && !values.has(column)) values.set(column, value);
  };

  add('product_code', row.product_code);
  add('movement_type', 'INBOUND');
  add('quantity', row.quantity);
  add('origin_module', ORIGIN_MODULE);
  add('origin_id', row.invoice_id);
  add('invoice_id', row.invoice_id);
  add('nfe_number', row.invoice_number);
  add('invoice_number', row.invoice_number);
  add('access_key', row.access_key);
  add('nfe_key', row.access_key);
  add('reference_type', 'NFE_INBOUND');
  add('reference_id', row.invoice_id);
  add('source_type', 'INBOUND');
  add('source_id', row.invoice_id);
  add('description', row.description);
  add('unit_code', row.unit_code);
  add('unit', row.unit_code);
  add('notes', `Backfill inbound NF-e ${row.invoice_number}`);
  add('movement_date', row.movement_at);
  add('movement_at', row.movement_at);
  add('created_at', row.movement_at);
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
    [ORIGIN_MODULE, String(row.invoice_id), row.product_code],
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
      'backfill_product_movements_from_inbound_invoices',
    ]);

    const columns = await getTargetColumns(client);
    const rows = await loadSourceRows(client, options);
    const unmappedItems = await countUnmappedItems(client, options.invoiceId);
    let existing = 0;
    let pending = 0;

    for (const row of rows) {
      if (await alreadyExists(client, row)) existing += 1;
      else pending += 1;
    }

    console.log({
      mode: options.apply ? 'APPLY' : 'PREVIEW',
      sourceRows: rows.length,
      existing,
      pending,
      unmappedItems,
    });

    if (unmappedItems > 0) {
      console.warn(`${unmappedItems} inbound item(s) were ignored because product_code is empty.`);
    }

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
    console.log({ ok: true, inserted, skipped: rows.length - inserted, unmappedItems });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[backFillProductMovementsFromInboundsInvoices] ERROR:', error);
  process.exitCode = 1;
});

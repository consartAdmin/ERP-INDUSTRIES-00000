// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersQuery.repository.js — Listagem e busca                         ║
// ║ search / list / listPendingNfe                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ORDER_STATUS } from '../../services/shared/constants/orderStatus.js';
import { AGG_FIELDS, ORDER_SELECT, buildBaseFromWhere } from './orders.sql.js';
import { ensureTables } from './ordersSchema.repository.js';
import { reportOrdersError } from './orders.utils.js';
import { rowToOrder } from './orders.mappers.js';

// ----------------------------------------------------------------------
// Listagem & Busca
// ----------------------------------------------------------------------
export async function search({
  q = '',
  limit = 20,
  offset = 0,
  status,
  dateFrom,
  dateTo,
  nfeStatus,
  environment,
  onlyWithNfe = false,
} = {}) {
  await ensureTables();

  const where = [];
  const args = [];
  let ai = 1;

  // Hide orders already returned to their original budget.
  where.push(`COALESCE(o.status, '') <> '${ORDER_STATUS.RETURNED_TO_BUDGET}'`);

  if (q && String(q).trim()) {
    const val = `%${String(q).toLowerCase().trim()}%`;
    where.push(`(
      LOWER(COALESCE(o.customer_name, ''))     LIKE $${ai} OR
      LOWER(COALESCE(o.customer_tax_id, ''))   LIKE $${ai} OR
      LOWER(COALESCE(o.customer_email, ''))    LIKE $${ai} OR
      CAST(o.order_id AS TEXT)                 LIKE $${ai} OR
      CAST(ii.nfe_number AS TEXT)              LIKE $${ai} OR
      LOWER(COALESCE(ii.nfe_key, ''))          LIKE $${ai}
    )`);
    args.push(val);
    ai++;
  }

  if (status && String(status).trim()) {
    const norm = String(status).trim();
    if (norm.toUpperCase() !== 'TODOS') {
      where.push(`o.status = $${ai}`);
      args.push(norm);
      ai++;
    }
  }

  if (dateFrom) {
    where.push(`o.issue_date >= $${ai}`);
    args.push(dateFrom);
    ai++;
  }

  if (dateTo) {
    where.push(`o.issue_date <= $${ai}`);
    args.push(dateTo);
    ai++;
  }

  if (nfeStatus && String(nfeStatus).trim()) {
    const norm = String(nfeStatus).trim();
    if (norm.toUpperCase() !== 'TODOS') {
      where.push(`ii.nfe_status = $${ai}`);
      args.push(norm);
      ai++;
    }
  }

  if (environment && String(environment).trim()) {
    const norm = String(environment).trim();
    if (norm.toUpperCase() !== 'TODOS') {
      where.push(`ii.nfe_environment = $${ai}`);
      args.push(norm);
      ai++;
    }
  }

  if (onlyWithNfe) {
    where.push(`ii.invoice_id IS NOT NULL`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const base = buildBaseFromWhere(whereSql);

  const sqlRows = `
    SELECT ${ORDER_SELECT},
           ${AGG_FIELDS}
    ${base}
    ORDER BY o.issue_date DESC, o.order_id DESC
    LIMIT $${ai} OFFSET $${ai + 1}
  `;

  const countArgs = [...args];
  args.push(Number(limit) || 20, Number(offset) || 0);

  const sqlCount = `
    SELECT COUNT(*) AS total
    ${base}
  `;

  const client = await pool.connect();
  try {
    const [rowsRes, countRes] = await Promise.all([
      client.query(sqlRows, args),
      client.query(sqlCount, countArgs),
    ]);

    const rows = rowsRes.rows.map(rowToOrder);
    const total = Number(countRes.rows?.[0]?.total || 0);
    return { ok: true, rows, total };
  } catch (err) {
    reportOrdersError('[ordersApi.search] ERR:', err);
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}

export async function list({
  limit = 20,
  offset = 0,
  status,
  nfeStatus,
  environment,
  onlyWithNfe = false,
  dateFrom,
  dateTo,
} = {}) {
  return search({
    q: '',
    limit,
    offset,
    status,
    nfeStatus,
    environment,
    onlyWithNfe,
    dateFrom,
    dateTo,
  });
}
// ----------------------------------------------------------------------
// Pedidos pendentes de NF-e → nfe_status IS NULL
// ----------------------------------------------------------------------
export async function listPendingNfe() {
  await ensureTables();

  const whereSql = `WHERE ii.invoice_id IS NULL`;
  const sql = `
    SELECT ${ORDER_SELECT}, ${AGG_FIELDS}
    ${buildBaseFromWhere(whereSql)}
    ORDER BY o.issue_date DESC, o.order_id DESC
  `;

  const client = await pool.connect();
  try {
    const res = await client.query(sql);
    const rows = res.rows.map(rowToOrder);
    const count = rows.length;
    const totalAmount = rows.reduce((acc, r) => acc + Number(r.total_amount || 0), 0);
    return { ok: true, count, totalAmount, pending: rows };
  } catch (err) {
    reportOrdersError('[ordersApi.listPendingNfe] ERR:', err);
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}

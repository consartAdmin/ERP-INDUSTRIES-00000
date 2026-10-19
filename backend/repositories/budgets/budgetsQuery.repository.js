// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsQuery.repository.js — Listagem & Busca                        ║
// ║ search / list                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_BUDGETS,
  TB_BUDGET_ITEMS,
} from './budgets.constants.js';
import { rowToBudget } from './budgets.mappers.js';
import {
  AGG_FIELDS,
  BUDGET_SELECT,
  BUDGET_SORT_COLUMNS,
} from './budgets.sql.js';

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
  orderBy = 'budget_id',
  orderDirection = 'desc',
} = {}) {

  const where = [];
  const args = [];
  let ai = 1;

  const requestedOrderBy =
    String(orderBy || 'budget_id')
      .trim();

  const sortColumn =
    BUDGET_SORT_COLUMNS[requestedOrderBy] ||
    BUDGET_SORT_COLUMNS.budget_id;

  const sortDirection =
    String(orderDirection || 'desc')
      .trim()
      .toLowerCase() === 'asc'
      ? 'ASC'
      : 'DESC';

  const orderSql = `
  ORDER BY
    ${sortColumn} ${sortDirection} NULLS LAST,
    b.budget_id DESC
`;

  if (q && String(q).trim()) {
    const raw = String(q).trim();
    const like = `%${raw.toLowerCase()}%`;

    where.push(`(
        LOWER(COALESCE(b.customer_name::text, '')) LIKE $${ai} OR
        COALESCE(b.customer_tax_id, '') LIKE $${ai + 1} OR
        LOWER(COALESCE(b.seller_id::text, '')) LIKE $${ai} OR
        CAST(b.budget_id AS TEXT) LIKE $${ai + 1}
      )`);
    args.push(like, `%${raw}%`);
    ai += 2;
  }

  if (status && String(status).trim()) {
    where.push(`b.status = $${ai}`);
    args.push(status);
    ai++;
  }

  if (dateFrom) {
    where.push(`b.issue_date >= $${ai}`);
    args.push(dateFrom);
    ai++;
  }

  if (dateTo) {
    where.push(`b.issue_date <= $${ai}`);
    args.push(dateTo);
    ai++;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const base = `
      FROM ${TB_BUDGETS} b
      LEFT JOIN ${TB_BUDGET_ITEMS} i ON i.budget_id = b.budget_id
      ${whereSql}
    `;

  const sqlRows = `
    SELECT ${BUDGET_SELECT},
          ${AGG_FIELDS}
    ${base}
    GROUP BY b.budget_id
    ${orderSql}
    LIMIT $${ai} OFFSET $${ai + 1}
  `;
  args.push(Number(limit) || 20, Number(offset) || 0);

  const sqlCount = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT b.budget_id
        ${base}
        GROUP BY b.budget_id
      ) x
    `;

  const client = await pool.connect();

  try {
    const [rowsRes, countRes] = await Promise.all([
      client.query(sqlRows, args),
      client.query(sqlCount, args.slice(0, ai - 1)),
    ]);

    const rows = rowsRes.rows.map(rowToBudget);
    const total = Number(countRes.rows?.[0]?.total || 0);

    return { ok: true, rows, total };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  } finally {
    client.release();
  }
}

export async function list({ limit = 20, offset = 0 } = {}) {
  return search({ q: '', limit, offset });
}

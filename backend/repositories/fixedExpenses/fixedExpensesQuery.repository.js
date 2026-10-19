// ╔════════════════════════════════════════════════════════════════════╗
// ║ fixedExpensesQuery.repository.js — list / count / getById          ║
// ║ Tabela: "fixedExpenses"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE, ALLOWED_ORDER } from './fixedExpenses.constants.js';
import { q, parseOrder, buildWhere } from './fixedExpenses.sql.js';

/** Lista */
export async function list(opts = {}) {
  const {
    search,
    report_name,
    date_from,
    date_to,
    customer_id,
    orderBy = 'created_at DESC',
    limit = 20,
    offset = 0,
  } = opts;

  const allowedOrder = ALLOWED_ORDER;
  const orderClause = parseOrder(orderBy, allowedOrder);

  const { sql: whereSql, params } = buildWhere({ search, report_name, date_from, date_to, customer_id });

  params.push(Math.max(1, Math.min(200, Number(limit) || 20)));
  params.push(Math.max(0, Number(offset) || 0));

  const sql = `
    SELECT id, customer_id, report_name, payload, created_at, updated_at
      FROM ${TABLE}
      ${whereSql}
      ${orderClause || ' ORDER BY created_at DESC '}
      LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const { rows } = await q(sql, params);
  return rows;
}

/** Count p/ paginação */
export async function count(filters = {}) {
  const { sql: whereSql, params } = buildWhere(filters);
  const { rows } = await q(`SELECT COUNT(*)::int AS total FROM ${TABLE} ${whereSql}`, params);
  return rows?.[0]?.total ?? 0;
}

/** Get por ID (UUID) */
export async function getById(id) {
  const { rows } = await q(
    `SELECT id, customer_id, report_name, payload, created_at, updated_at
       FROM ${TABLE}
      WHERE id = $1::uuid`,
    [String(id).trim()],
  );
  return rows[0] || null;
}

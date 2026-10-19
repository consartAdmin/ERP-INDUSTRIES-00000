// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAdsQuery.repository.js — list / getById (CRUD genérico)      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { getConfig } from './googleAds.utils.js';
import { buildWhereClause, buildOrderClause } from './googleAds.sql.js';

/* ============================================================================
 * CRUD GENÉRICO
 * ========================================================================== */

export async function list(resource, query = {}) {
  const { table, pk } = getConfig(resource);
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.max(Math.min(Number(query.limit || 20), 200), 1);
  const offset = (page - 1) * limit;

  const { where, values } = buildWhereClause(resource, query);
  const order = buildOrderClause(resource, query.orderBy, query.orderDir);

  const sql = `
    SELECT *
      FROM ${table}
      ${where}
      ${order}
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
  `;

  const countSql = `
    SELECT COUNT(*)::INT AS total
      FROM ${table}
      ${where}
  `;

  const [rowsResult, countResult] = await Promise.all([
    pool.query(sql, [...values, limit, offset]),
    pool.query(countSql, values),
  ]);

  return {
    rows: rowsResult.rows,
    total: countResult.rows[0]?.total || 0,
    page,
    limit,
    sort: {
      orderBy: query.orderBy || pk,
      orderDir: query.orderDir || 'DESC',
    },
  };
}

export async function getById(resource, id) {
  const { table, pk } = getConfig(resource);

  const sql = `
    SELECT *
      FROM ${table}
     WHERE ${pk} = $1
     LIMIT 1
  `;

  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

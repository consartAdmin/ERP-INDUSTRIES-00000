// ╔══════════════════════════════════════════════════════════════════════╗
// ║ pdv_loginsQuery.repository.js — list / getById                       ║
// ║ Tabela: public.pdv_logins                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE, SAFE_COLUMNS } from './pdv_logins.constants.js';
import { normalizeRole, normalizeBoolean } from './pdv_logins.sanitizers.js';

export async function list({ search = '', role, active, page = 1, limit = 50 } = {}) {
  const where = [];
  const values = [];

  const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const normalizedLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));

  if (String(search).trim()) {
    values.push(`%${String(search).trim()}%`);
    where.push(`(username ILIKE $${values.length} OR full_name ILIKE $${values.length})`);
  }

  if (role !== undefined && role !== null && role !== '') {
    values.push(normalizeRole(role));
    where.push(`role = $${values.length}`);
  }

  if (active !== undefined && active !== null && active !== '') {
    values.push(normalizeBoolean(active));
    where.push(`active = $${values.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM ${TABLE} ${whereSql}`,
    values
  );

  const queryValues = [...values, normalizedLimit, (normalizedPage - 1) * normalizedLimit];
  const result = await pool.query(
    `SELECT ${SAFE_COLUMNS}
       FROM ${TABLE}
       ${whereSql}
      ORDER BY full_name ASC, id ASC
      LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    queryValues
  );

  const total = countResult.rows[0]?.total ?? 0;
  return {
    data: result.rows,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      total_pages: Math.ceil(total / normalizedLimit),
    },
  };
}

export async function getById(id) {
  const result = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

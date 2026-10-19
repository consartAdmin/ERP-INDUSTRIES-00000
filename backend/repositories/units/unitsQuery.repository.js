// ╔════════════════════════════════════════════════════════════════════╗
// ║ unitsQuery.repository.js — list / getById                          ║
// ║ Tabela: public.units                                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './units.constants.js';
import { notEmpty, toInt } from './units.sanitizers.js';

export async function list({ q, limit = 50, offset = 0, onlyActive } = {}) {
  const where = [];
  const values = [];
  let i = 1;

  if (notEmpty(q)) {
    where.push(`(LOWER(unit) LIKE LOWER($${i}) OR LOWER(COALESCE(description,'')) LIKE LOWER($${i}))`);
    values.push(`%${q.trim()}%`);
    i++;
  }

  if (onlyActive === true || onlyActive === 'true' || onlyActive === 1 || onlyActive === '1') {
    where.push(`is_active IS TRUE`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const lim = toInt(limit, 50) ?? 50;
  const off = toInt(offset, 0) ?? 0;

  const sql = `
    SELECT unit_id, unit, description, fator, is_active, created_at, updated_at
      FROM ${TB}
      ${whereSql}
     ORDER BY unit ASC
     LIMIT $${i++} OFFSET $${i++};
  `;
  values.push(lim, off);

  const countSql = `
    SELECT COUNT(*)::INT AS total
      FROM ${TB}
      ${whereSql};
  `;

  const [rowsRes, countRes] = await Promise.all([
    pool.query(sql, values),
    pool.query(countSql, values.slice(0, values.length - 2)),
  ]);

  return {
    rows: rowsRes.rows,
    total: countRes.rows[0]?.total ?? 0,
    limit: lim,
    offset: off,
  };
}

export async function getById(id) {
  const { rows } = await pool.query(
    `SELECT unit_id, unit, description, fator, is_active, created_at, updated_at
       FROM ${TB}
      WHERE unit_id = $1
      LIMIT 1;`,
    [Number(id)]
  );
  return rows[0] || null;
}

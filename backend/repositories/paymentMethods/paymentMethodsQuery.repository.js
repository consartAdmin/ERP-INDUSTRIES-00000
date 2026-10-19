// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentMethodsQuery.repository.js — getById / list                 ║
// ║ Tabela: public."paymentMethods"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, PK } from './paymentMethods.constants.js';
import { SELECT_COLUMNS } from './paymentMethods.sql.js';
import { toInt, toBool } from './paymentMethods.sanitizers.js';
import { fromDb } from './paymentMethods.mappers.js';

export async function getById(id) {
  const safeId = toInt(id, 0);
  if (!safeId) throw new Error('ID inválido.');

  const { rows } = await pool.query(`
    SELECT ${SELECT_COLUMNS}
    FROM ${TB}
    WHERE ${PK} = $1
    LIMIT 1;
  `, [safeId]);

  return rows[0] ? fromDb(rows[0]) : null;
}

export async function list({ q = '', active, limit = 50, offset = 0 } = {}) {
  const where = [];
  const values = [];
  let parameter = 1;

  const search = String(q || '').trim();
  const safeLimit = Math.min(200, Math.max(1, toInt(limit, 50)));
  const safeOffset = Math.max(0, toInt(offset, 0));

  if (search) {
    where.push(`(LOWER("name") LIKE $${parameter} OR LOWER("type") LIKE $${parameter})`);
    values.push(`%${search.toLowerCase()}%`);
    parameter += 1;
  }

  if (typeof active !== 'undefined' && active !== null && active !== '') {
    where.push(`"active" = $${parameter}`);
    values.push(toBool(active));
    parameter += 1;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [dataResult, totalResult] = await Promise.all([
    pool.query(`
      SELECT ${SELECT_COLUMNS}
      FROM ${TB}
      ${whereSql}
      ORDER BY "active" DESC, LOWER("name") ASC
      LIMIT $${parameter} OFFSET $${parameter + 1};
    `, [...values, safeLimit, safeOffset]),
    pool.query(`SELECT COUNT(*)::int AS total FROM ${TB} ${whereSql};`, values),
  ]);

  return {
    rows: dataResult.rows.map(fromDb),
    total: totalResult.rows[0]?.total ?? 0,
    limit: safeLimit,
    offset: safeOffset,
  };
}

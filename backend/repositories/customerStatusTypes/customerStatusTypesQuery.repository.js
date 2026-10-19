// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusTypesQuery.repository.js — list / search             ║
// ║ Tabela: public."customerStatusTypes"                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl, ALIAS } from './customerStatusTypes.constants.js';
import { toNumOrNull } from './customerStatusTypes.sanitizers.js';
import { mapRow, mapSearchRow } from './customerStatusTypes.mappers.js';

/** LIST — p/ grids e administração */
export async function list({
  q,
  is_active,
  limit = 50,
  offset = 0,
  orderBy = 'sort_order',
  order = 'asc',
} = {}) {
  const params = [];
  const where = [];

  const orderSafe = ['name_pt', 'internal_code', 'sort_order'].includes(orderBy)
    ? orderBy
    : 'sort_order';
  const dir = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  if (typeof is_active === 'boolean') {
    params.push(is_active);
    where.push(`${ALIAS}.is_active = $${params.length}`);
  }

  if (q && String(q).trim()) {
    const norm = `%${String(q).toLowerCase().trim()}%`;
    params.push(norm, norm);
    where.push(`(
      LOWER(${ALIAS}.name_pt) LIKE $${params.length - 1}
      OR LOWER(${ALIAS}.internal_code) LIKE $${params.length}
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  params.push(toNumOrNull(limit) ?? 50);
  params.push(toNumOrNull(offset) ?? 0);

  const sql = `
    SELECT *
    FROM ${tbl()} ${ALIAS}
    ${whereSql}
    ORDER BY ${ALIAS}."${orderSafe}" ${dir}
    LIMIT $${params.length - 1}
    OFFSET $${params.length};
  `;

  const countSql = `
    SELECT COUNT(*)::INT AS total
    FROM ${tbl()} ${ALIAS}
    ${whereSql};
  `;

  const [rowsRes, totalRes] = await Promise.all([
    pool.query(sql, params),
    pool.query(countSql, params.slice(0, params.length - 2)),
  ]);

  return {
    rows: rowsRes.rows.map(mapRow),
    total: totalRes.rows[0]?.total ?? 0,
    limit: toNumOrNull(limit) ?? 50,
    offset: toNumOrNull(offset) ?? 0,
  };
}

/** SEARCH — leve, ideal para dropdowns / selects */
export async function search({ q, is_active = true, limit = 20, offset = 0 } = {}) {
  const params = [];
  const where = [];

  params.push(!!is_active);
  where.push(`${ALIAS}.is_active = $${params.length}`);

  if (q && String(q).trim()) {
    const norm = `%${String(q).toLowerCase().trim()}%`;
    params.push(norm, norm);
    where.push(`(
      LOWER(${ALIAS}.name_pt) LIKE $${params.length - 1}
      OR LOWER(${ALIAS}.internal_code) LIKE $${params.length}
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  params.push(toNumOrNull(limit) ?? 20);
  const limIdx = params.length;
  params.push(toNumOrNull(offset) ?? 0);
  const offIdx = params.length;

  const sql = `
    SELECT
      ${ALIAS}.id,
      ${ALIAS}.name_pt,
      ${ALIAS}.internal_code,
      ${ALIAS}.color_hex
    FROM ${tbl()} ${ALIAS}
    ${whereSql}
    ORDER BY ${ALIAS}."sort_order" ASC, LOWER(${ALIAS}.name_pt) ASC
    LIMIT $${limIdx}
    OFFSET $${offIdx};
  `;

  const { rows } = await pool.query(sql, params);
  return {
    rows: rows.map(mapSearchRow),
    limit: toNumOrNull(limit) ?? 20,
    offset: toNumOrNull(offset) ?? 0,
  };
}

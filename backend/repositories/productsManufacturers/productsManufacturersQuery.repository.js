// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsManufacturersQuery.repository.js — listagem / get by ID    ║
// ║ Tabela: public."productsManufactures"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS, COLS } from './productsManufacturers.constants.js';
import { toBool, notEmptyStr, sanitizeOrder } from './productsManufacturers.sanitizers.js';
import { mapRow } from './productsManufacturers.mappers.js';

// ──────────────────────────────────────────────────────────────────────────────
// Listagem
// ──────────────────────────────────────────────────────────────────────────────
export async function listProductsManufacturers(params = {}) {
  const {
    q,
    is_active,
    limit = 50,
    offset = 0,
    orderBy = COLS.name,
    dir = 'ASC',
  } = params;

  const { orderBy: ob, dir: od } = sanitizeOrder(orderBy, dir);

  const where = [];
  const values = [];
  let i = 1;

  if (notEmptyStr(q)) {
    where.push(`LOWER(${COLS.name}) LIKE LOWER($${i++})`);
    values.push(`%${q.trim()}%`);
  }

  const activeBool = toBool(is_active);
  if (activeBool !== null) {
    where.push(`${COLS.is_active} = $${i++}`);
    values.push(activeBool);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `
    SELECT ${COLS.id}, ${COLS.name}, ${COLS.created_at}, ${COLS.updated_at}, ${COLS.is_active}
    FROM public.${TB} ${ALIAS}
    ${whereSql}
    ORDER BY ${ob} ${od}
    LIMIT $${i++} OFFSET $${i++};
  `;
  values.push(Number(limit) || 50, Number(offset) || 0);

  const countSql = `
    SELECT COUNT(*)::INT AS total
    FROM public.${TB} ${ALIAS}
    ${whereSql};
  `;

  const [rowsRes, countRes] = await Promise.all([
    pool.query(sql, values),
    pool.query(countSql, values.slice(0, values.length - 2)),
  ]);

  return {
    rows: rowsRes.rows.map(mapRow),
    total: countRes.rows[0]?.total ?? 0,
    limit: Number(limit) || 50,
    offset: Number(offset) || 0,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Get by ID
// ──────────────────────────────────────────────────────────────────────────────
export async function getProductsManufacturerById(id) {
  const res = await pool.query(
    `
      SELECT ${COLS.id}, ${COLS.name}, ${COLS.created_at}, ${COLS.updated_at}, ${COLS.is_active}
      FROM public.${TB}
      WHERE ${COLS.id} = $1
      LIMIT 1;
    `,
    [id]
  );
  return mapRow(res.rows[0]);
}

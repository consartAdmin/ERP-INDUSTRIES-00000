// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsSubgroupsQuery.repository.js — listagem / buscar por ID    ║
// ║ Tabela: public."productsSubgroups"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS, COLS } from './productsSubgroups.constants.js';
import { toBool, notEmptyStr, sanitizeOrder } from './productsSubgroups.sanitizers.js';
import { mapRow } from './productsSubgroups.mappers.js';

// ──────────────────────────────────────────────────────────────────────────────
/** Listagem com filtros */
// ──────────────────────────────────────────────────────────────────────────────
export async function listProductsSubgroups(params = {}) {
  const { q, group_id, is_active, limit = 50, offset = 0, orderBy = COLS.name, dir = 'ASC' } = params;
  const { orderBy: ob, dir: od } = sanitizeOrder(orderBy, dir);
  const where = [];
  const values = [];
  let i = 1;

  if (notEmptyStr(q)) {
    where.push(`LOWER(${COLS.name}) LIKE LOWER($${i++})`);
    values.push(`%${q.trim()}%`);
  }
  if (group_id) {
    where.push(`${COLS.group_id} = $${i++}`);
    values.push(group_id);
  }

  const activeBool = toBool(is_active);
  if (activeBool !== null) {
    where.push(`${COLS.is_active} = $${i++}`);
    values.push(activeBool);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `
    SELECT ${COLS.id}, ${COLS.name}, ${COLS.group_id}, ${COLS.created_at}, ${COLS.updated_at}, ${COLS.is_active}
    FROM public.${TB} ${ALIAS}
    ${whereSql}
    ORDER BY ${ob} ${od}
    LIMIT $${i++} OFFSET $${i++};
  `;
  values.push(Number(limit), Number(offset));

  const countSql = `SELECT COUNT(*)::INT AS total FROM public.${TB} ${ALIAS} ${whereSql};`;
  const [rowsRes, countRes] = await Promise.all([
    pool.query(sql, values),
    pool.query(countSql, values.slice(0, values.length - 2)),
  ]);

  return {
    rows: rowsRes.rows.map(mapRow),
    total: countRes.rows[0]?.total ?? 0,
    limit: Number(limit),
    offset: Number(offset),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
/** Buscar por ID */
// ──────────────────────────────────────────────────────────────────────────────
export async function getProductsSubgroupById(id) {
  const res = await pool.query(
    `SELECT ${COLS.id}, ${COLS.name}, ${COLS.group_id}, ${COLS.created_at}, ${COLS.updated_at}, ${COLS.is_active}
     FROM public.${TB}
     WHERE ${COLS.id} = $1
     LIMIT 1;`,
    [id]
  );
  return mapRow(res.rows[0]);
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ productBarCodeSecondQuery.repository.js — list / getById / findBy...    ║
// ║ Tabela principal: public."productBarCodeSecond"                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, COLS } from './productBarCodeSecond.constants.js';
import { notEmptyStr, sanitizeOrder } from './productBarCodeSecond.sanitizers.js';
import { mapRow } from './productBarCodeSecond.mappers.js';

// ──────────────────────────────────────────────────────────────────────────────
// List / Get
// ──────────────────────────────────────────────────────────────────────────────
export async function listSecondBarCodes(params = {}) {
  const {
    q, // busca no próprio código de barras
    product_code,
    product_unit_id,
    price_id,
    limit = 50,
    offset = 0,
    orderBy = COLS.second_bar_code,
    dir = 'ASC',
  } = params;

  const { orderBy: ob, dir: od } = sanitizeOrder(orderBy, dir);

  const where = [];
  const values = [];
  let i = 1;

  if (notEmptyStr(q)) {
    where.push(`LOWER(${COLS.second_bar_code}) LIKE LOWER($${i++})`);
    values.push(`%${q.trim()}%`);
  }
  if (notEmptyStr(product_code)) {
    where.push(`${COLS.product_code} = $${i++}`);
    values.push(String(product_code).trim());
  }
  if (product_unit_id !== undefined && product_unit_id !== null && product_unit_id !== '') {
    where.push(`${COLS.product_unit_id} = $${i++}`);
    values.push(Number(product_unit_id));
  }
  if (price_id !== undefined && price_id !== null && price_id !== '') {
    where.push(`${COLS.price_id} = $${i++}`);
    values.push(Number(price_id));
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

const sql = `
  SELECT
    pbs.${COLS.id},
    pbs.${COLS.product_code},
    p.description AS product_description,     -- ✅ vem do products
    pbs.${COLS.product_unit_id},
    pbs.${COLS.second_bar_code},
    pbs.${COLS.code_type},
    pbs.${COLS.price_id},
    pbs.${COLS.created_at},
    pbs.${COLS.updated_at}
  FROM public.${TB} pbs
  LEFT JOIN public."products" p
    ON p.product_code = pbs.${COLS.product_code}
  ${whereSql}
  ORDER BY pbs.${ob} ${od}
  LIMIT $${i++} OFFSET $${i++};
`;

  values.push(Number(limit) || 50, Number(offset) || 0);

  const countSql = `
    SELECT COUNT(*)::INT AS total
      FROM public.${TB}
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

export async function getSecondBarCodeById(id) {
  const { rows } = await pool.query(
    `
    SELECT
      pbs.${COLS.id},
      pbs.${COLS.product_code},
      p.description AS product_description,
      pbs.${COLS.product_unit_id},
      pbs.${COLS.second_bar_code},
      pbs.${COLS.code_type},
      pbs.${COLS.price_id},
      pbs.${COLS.created_at},
      pbs.${COLS.updated_at}
    FROM public.${TB} pbs
    LEFT JOIN public."products" p
      ON p.product_code = pbs.${COLS.product_code}
    WHERE pbs.${COLS.id} = $1
    LIMIT 1;
    `,
    [id]
  );
  return mapRow(rows[0]);
}

/**
 * Busca por código de barras exato (para uso no PDV / conferência).
 */
export async function findBySecondBarCode(secondBarCode) {
  const { rows } = await pool.query(
    `
    SELECT ${COLS.id}, ${COLS.product_code}, ${COLS.product_unit_id},
           ${COLS.second_bar_code}, ${COLS.code_type}, ${COLS.price_id},
           ${COLS.created_at}, ${COLS.updated_at}
      FROM public.${TB}
     WHERE ${COLS.second_bar_code} = $1;
    `,
    [secondBarCode]
  );
  return rows.map(mapRow);
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGradesQuery.repository.js — listByProduct / getBySku       ║
// ║ Tabela: public."productsGrades"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_GRADES, TB_PRODUCTS } from './productsGrades.constants.js';
import { toStr } from './productsGrades.sanitizers.js';
import { ensureTable } from './productsGradesSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   LIST BY PRODUCT ID
────────────────────────────────────────────────────────────── */
export async function listByProduct(
  productId,
  { limit = 500, offset = 0 } = {}
) {
  await ensureTable();

  const pid = toStr(productId);

  const { rows } = await pool.query(
    `
      SELECT
        pg.product_grade_id,
        pg.product_id,
        pg.grade_id,
        g.grade,
        g.description,
        pg.stock,
        pg.is_active,
        pg.created_at,
        pg.updated_at
      FROM ${TB} pg
      JOIN ${TB_GRADES} g
        ON g.grade_id = pg.grade_id
      WHERE pg.product_id = $1
      ORDER BY pg.is_active DESC, g.grade ASC
      LIMIT $2 OFFSET $3
    `,
    [pid, limit, offset]
  );

  const totalRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM ${TB}
      WHERE product_id = $1
    `,
    [pid]
  );

  return {
    rows,
    total: totalRes.rows?.[0]?.total ?? rows.length,
    limit,
    offset,
  };
}

/* ──────────────────────────────────────────────────────────────
   GET BY SKU
────────────────────────────────────────────────────────────── */
export async function getBySku(product_code) {
  await ensureTable();

  const raw = String(product_code || '').trim();

  if (!raw) return [];

  const numeric = String(Number(raw) || '').trim();

  const padded6 =
    /^\d+$/.test(raw)
      ? raw.padStart(6, '0')
      : raw;

  const padded10 =
    /^\d+$/.test(raw)
      ? raw.padStart(10, '0')
      : raw;

  const sql = `
    SELECT
      pg.product_grade_id,
      pg.product_id,
      pg.grade_id,
      g.grade,
      g.description,
      pg.stock,
      pg.is_active,

      p.product_id AS erp_product_id,
      p.product_code,
      p.description AS product_description

    FROM ${TB} pg

    INNER JOIN ${TB_GRADES} g
      ON g.grade_id = pg.grade_id

    LEFT JOIN ${TB_PRODUCTS} p
      ON (
           TRIM(p.product_code) = TRIM(pg.product_id)
        OR TRIM(p.product_id::text) = TRIM(pg.product_id)
      )

    WHERE
         TRIM(pg.product_id) = TRIM($1)
      OR TRIM(pg.product_id) = TRIM($2)
      OR TRIM(pg.product_id) = TRIM($3)
      OR TRIM(pg.product_id) = TRIM($4)

    AND COALESCE(pg.is_active, TRUE) = TRUE

    ORDER BY
      g.grade ASC NULLS LAST,
      pg.product_grade_id ASC
  `;

  const { rows } = await pool.query(
    sql,
    [
      raw,
      numeric,
      padded6,
      padded10,
    ]
  );

  return rows;
}

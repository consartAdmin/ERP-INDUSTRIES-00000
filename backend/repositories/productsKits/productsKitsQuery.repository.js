// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKitsQuery.repository.js — listProductsKits / getProductsKitById ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_KITS, TB_ITEMS } from './productsKits.constants.js';
import { normalizeBool } from './productsKits.sanitizers.js';
import { ensureProductsKitsTables } from './productsKitsSchema.repository.js';

export async function listProductsKits({ q = '', active = true } = {}) {
  await ensureProductsKitsTables();

  const params = [];
  let where = 'WHERE 1=1';

  if (active !== 'all') {
    params.push(normalizeBool(active));
    where += ` AND k.active = $${params.length}`;
  }

  if (q) {
    params.push(`%${q}%`);
    where += ` AND (
      k.kit_sku ILIKE $${params.length}
      OR k.kit_description ILIKE $${params.length}
    )`;
  }

  const result = await pool.query(`
    SELECT
      k.*,
      p.product_id,
      p.product_code,
      p.description AS product_description,
      p.product_unit_id,
      p.product_grade_id,
      p.product_price_id,
      p.product_stock_id,
      p.products_fiscal_id,
      COALESCE(COUNT(i.id), 0)::INT AS total_items,
      COALESCE(SUM(i.quantity * COALESCE(i.unit_factor, 1) * i.cost_unit), 0)::NUMERIC(14,2) AS total_cost,
      COALESCE(SUM(i.quantity * COALESCE(i.unit_factor, 1) * i.sale_price_unit), 0)::NUMERIC(14,2) AS total_sale_items
    FROM ${TB_KITS} k
    LEFT JOIN public.products p
      ON p.product_code = k.kit_sku
    LEFT JOIN ${TB_ITEMS} i
      ON i.kit_id = k.id
      AND i.active = TRUE
    ${where}
    GROUP BY
      k.id,
      p.product_id,
      p.product_code,
      p.description,
      p.product_unit_id,
      p.product_grade_id,
      p.product_price_id,
      p.product_stock_id,
      p.products_fiscal_id
    ORDER BY k.id DESC
  `, params);

  return result.rows;
}

export async function getProductsKitById(id) {
  await ensureProductsKitsTables();

  const kitResult = await pool.query(`
    SELECT
      k.*,
      p.product_id,
      p.product_code,
      p.description AS product_description,
      p.product_unit_id,
      p.product_grade_id,
      p.product_price_id,
      p.product_stock_id,
      p.products_fiscal_id
    FROM ${TB_KITS} k
    LEFT JOIN public.products p
      ON p.product_code = k.kit_sku
    WHERE k.id = $1
  `, [id]);

  if (!kitResult.rows.length) return null;

  const itemsResult = await pool.query(`
    SELECT *
    FROM ${TB_ITEMS}
    WHERE kit_id = $1
    ORDER BY id ASC
  `, [id]);

  return {
    ...kitResult.rows[0],
    items: itemsResult.rows,
  };
}

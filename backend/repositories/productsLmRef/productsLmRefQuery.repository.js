// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsLmRefQuery.repository.js — findAll / findById              ║
// ║ Tabela: public."productsLmRef"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './productsLmRef.constants.js';
import { PRODUCTS_LM_REF_COLUMNS } from './productsLmRef.sql.js';

export async function findAllProductsLmRef({
  supplierId,
  isActive,
  search,
  limit = 50,
  offset = 0,
} = {}) {
  const conditions = [];
  const values = [];

  if (supplierId !== undefined) {
    values.push(supplierId);
    conditions.push(`supplier_id = $${values.length}`);
  }

  if (isActive !== undefined) {
    values.push(isActive);
    conditions.push(`is_active = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(
      nf_product_code ILIKE $${values.length}
      OR product_code ILIKE $${values.length}
      OR description ILIKE $${values.length}
    )`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  values.push(limit, offset);

  const query = `
    SELECT ${PRODUCTS_LM_REF_COLUMNS}
    FROM ${TABLE}
    ${whereClause}
    ORDER BY product_lm_ref_id ASC
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
  `;

  const { rows } = await pool.query(query, values);
  return rows;
}

export async function findProductLmRefById(productLmRefId) {
  const { rows } = await pool.query(
    `SELECT ${PRODUCTS_LM_REF_COLUMNS}
     FROM ${TABLE}
     WHERE product_lm_ref_id = $1`,
    [productLmRefId],
  );

  return rows[0] ?? null;
}

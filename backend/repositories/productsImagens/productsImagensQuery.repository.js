// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsImagensQuery.repository.js — resolução de produto / listagens / getById ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRODUCTS } from './productsImagens.constants.js';
import { BASE_SELECT, ORDER_BY } from './productsImagens.sql.js';
import { toBool, normalizePositiveInt } from './productsImagens.sanitizers.js';

/* =========================================================================
   Resolução de produto (product_id → product_code)
   ========================================================================= */

export async function resolveProductCode(productId, client = pool) {
  const id = normalizePositiveInt(productId, null);
  if (!id) return null;

  const { rows } = await client.query(
    `SELECT product_code FROM ${TB_PRODUCTS} WHERE product_id = $1 LIMIT 1`,
    [id]
  );
  return rows[0]?.product_code ?? null;
}

/* =========================================================================
   Queries básicas
   ========================================================================= */

export async function listAll({ onlyActive = true } = {}) {
  const where = toBool(onlyActive, true) ? 'WHERE img.is_active = TRUE' : '';

  const { rows } = await pool.query(`
    ${BASE_SELECT}
    ${where}
    ORDER BY img.product_code ASC, img.barcode_id ASC NULLS FIRST, img.position ASC, img.product_image_id ASC;
  `);
  return rows;
}

export async function listByProductCode(productCode, { onlyActive = true } = {}) {
  let where = 'WHERE img.product_code = $1';
  if (toBool(onlyActive, true)) where += ' AND img.is_active = TRUE';

  const { rows } = await pool.query(
    `
    ${BASE_SELECT}
    ${where}
    ${ORDER_BY};
    `,
    [productCode]
  );
  return rows;
}

export async function listByProductId(productId, options = {}) {
  const productCode = await resolveProductCode(productId);
  if (!productCode) return [];
  return listByProductCode(productCode, options);
}

// Imagem principal geral do produto (barcode_id NULL); se não houver,
// cai para a primeira imagem ativa de qualquer unidade.
export async function getPrimaryImageByProductCode(productCode) {
  const { rows } = await pool.query(
    `
    ${BASE_SELECT}
    WHERE img.product_code = $1
      AND img.is_active = TRUE
    ORDER BY
      (img.barcode_id IS NULL) DESC,
      img.is_primary DESC,
      img.position ASC,
      img.product_image_id ASC
    LIMIT 1;
    `,
    [productCode]
  );
  return rows[0] || null;
}

export async function getPrimaryImageByProductId(productId) {
  const productCode = await resolveProductCode(productId);
  if (!productCode) return null;
  return getPrimaryImageByProductCode(productCode);
}

export async function getById(productImageId) {
  return getByIdWithClient(pool, productImageId);
}

export async function getByIdWithClient(client, productImageId) {
  const { rows } = await client.query(
    `
    ${BASE_SELECT}
    WHERE img.product_image_id = $1
    LIMIT 1;
    `,
    [productImageId]
  );
  return rows[0] || null;
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalQuery.repository.js — list / getById                 ║
// ║ getCurrentBySku / getCurrentByProduct                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS, TB_PRODUCTS } from './productsFiscal.constants.js';
import {
  isFiniteNum,
  toTrimOrNull,
} from './productsFiscal.sanitizers.js';
import { rowToModel } from './productsFiscal.mappers.js';
import { resolveProductCode } from './productsFiscalLookup.repository.js';

/* ──────────────────────────────────────────────────────────
   LIST / GET
────────────────────────────────────────────────────────── */
export async function list(params = {}) {
  const { q: qtext, productCode, product_code, current, limit = 20, offset = 0 } = params;

  const wh = ['1=1'];
  const values = [];
  let i = 1;

  const codeFilter = toTrimOrNull(product_code ?? productCode);
  if (codeFilter) {
    wh.push(`${ALIAS}.product_code = $${i}`);
    values.push(codeFilter);
    i++;
  }

  if (qtext) {
    wh.push(`(
      ${ALIAS}.product_code::text ILIKE $${i} OR
      ${ALIAS}.ncm ILIKE $${i} OR
      ${ALIAS}.cest ILIKE $${i} OR
      ${ALIAS}.cst_icms ILIKE $${i} OR
      ${ALIAS}.icms_cst ILIKE $${i} OR
      ${ALIAS}.csosn ILIKE $${i} OR
      ${ALIAS}.pis_cst ILIKE $${i} OR
      ${ALIAS}.cofins_cst ILIKE $${i} OR
      ${ALIAS}.ipi_cst ILIKE $${i} OR
      ${ALIAS}.observacao ILIKE $${i} OR
      ${ALIAS}.ncm_description ILIKE $${i} OR
      ${ALIAS}.cest_description ILIKE $${i} OR
      ${ALIAS}.classification_name ILIKE $${i} OR
      ${ALIAS}.profile_name ILIKE $${i} OR
      p.description ILIKE $${i}
    )`);
    values.push(`%${qtext}%`);
    i++;
  }

  if (current === true) wh.push(`${ALIAS}.is_current = TRUE`);
  else if (current === false) wh.push(`${ALIAS}.is_current = FALSE`);

  const sql = `
    SELECT
      ${ALIAS}.*,
      p.description AS product_description
    FROM ${TB} ${ALIAS}
    LEFT JOIN ${TB_PRODUCTS} p
      ON p.product_code = ${ALIAS}.product_code
    WHERE ${wh.join(' AND ')}
    ORDER BY ${ALIAS}.updated_at DESC, ${ALIAS}.products_fiscal_id DESC
    LIMIT $${i} OFFSET $${i + 1};
  `;

  values.push(Number(limit), Number(offset));
  const { rows } = await pool.query(sql, values);
  return rows.map(rowToModel);
}

export async function getById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM ${TB} WHERE products_fiscal_id = $1`,
    [Number(id)]
  );
  return rowToModel(rows[0]);
}

export async function getCurrentBySku(productCode) {
  const code = toTrimOrNull(productCode);
  if (!code) return null;

  const sql = `
    SELECT
      ${ALIAS}.*,
      p.description AS product_description
    FROM ${TB} ${ALIAS}
    LEFT JOIN ${TB_PRODUCTS} p
      ON p.product_code = ${ALIAS}.product_code
    WHERE ${ALIAS}.product_code = $1
      AND ${ALIAS}.is_current = TRUE
      AND ${ALIAS}.is_active = TRUE
    LIMIT 1;
  `;

  const { rows } = await pool.query(sql, [code]);
  return rows[0] ? rowToModel(rows[0]) : null;
}

// ✅ compat: se alguém ainda chama por productId numérico, resolve para SKU e busca
export async function getCurrentByProduct(productIdOrCode) {
  const client = await pool.connect();
  try {
    const code = await resolveProductCode(client, {
      product_id: isFiniteNum(productIdOrCode) ? Number(productIdOrCode) : null,
      product_code: !isFiniteNum(productIdOrCode) ? String(productIdOrCode) : null,
    });
    if (!code) return null;
    return await getCurrentBySku(code);
  } finally {
    client.release();
  }
}

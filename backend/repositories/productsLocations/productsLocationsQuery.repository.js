// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocationsQuery.repository.js — list / listByProductCode /    ║
// ║ getById (JOIN em products e productsBarCode)                         ║
// ║ ✅ Count consistente (repete JOIN quando necessário)                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB,
  ALIAS,
  TB_PRODUCTS,
  PRODUCTS_ALIAS,
  PRODUCT_DESC_COL,
  TB_BARCODES,
  BARCODES_ALIAS,
  BARCODE_COL,
} from './productsLocations.constants.js';
import { toBool } from './productsLocations.sanitizers.js';
import { normalizeRow } from './productsLocations.mappers.js';
import { buildWhere } from './productsLocations.sql.js';

/* ────────────────────────────────────────────────────────────────────
   CRUD
──────────────────────────────────────────────────────────────────── */
export async function list({
  q,
  product_code,
  store_id,
  corredor,
  prateleira,
  bandeja,
  limit = 50,
  offset = 0,
  onlyActive = false,
} = {}) {
  limit = Math.max(1, Math.min(1000, Number(limit) || 50));
  offset = Math.max(0, Number(offset) || 0);
  onlyActive = toBool(onlyActive, false);

  // ✅ Sempre fazemos LEFT JOIN para trazer descrição e barcode.
  // ✅ E o WHERE pode filtrar também pela descrição e barcode via aliases.
  const { where, params } = buildWhere({
    q,
    product_code,
    store_id,
    onlyActive,
    corredor: arguments[0]?.corredor,
    prateleira: arguments[0]?.prateleira,
    bandeja: arguments[0]?.bandeja
  });

  const sql = `
    SELECT
      ${ALIAS}.id,
      ${ALIAS}.product_code,
      ${PRODUCTS_ALIAS}."${PRODUCT_DESC_COL}" AS product_description,
      ${BARCODES_ALIAS}."${BARCODE_COL}"      AS barcode,
      ${ALIAS}.store_id,
      ${ALIAS}.corredor,
      ${ALIAS}.prateleira,
      ${ALIAS}.bandeja,
      ${ALIAS}.box,
      ${ALIAS}.observacao,
      ${ALIAS}.created_at,
      ${ALIAS}.updated_at,
      ${ALIAS}.is_active,
      -- localização principal do produto (products.product_location_id)
      COALESCE(${PRODUCTS_ALIAS}.product_location_id = ${ALIAS}.id, FALSE) AS is_primary
    FROM ${TB} ${ALIAS}
    LEFT JOIN ${TB_PRODUCTS} ${PRODUCTS_ALIAS}
      ON ${PRODUCTS_ALIAS}.product_code = ${ALIAS}.product_code
    LEFT JOIN LATERAL (
      -- um único barcode por produto (ativo primeiro): produto com vários
      -- códigos de barras não pode multiplicar a linha da localização
      SELECT pbx."${BARCODE_COL}"
      FROM ${TB_BARCODES} pbx
      WHERE pbx.product_code = ${ALIAS}.product_code
      ORDER BY pbx.is_active DESC NULLS LAST, pbx."${BARCODE_COL}" ASC
      LIMIT 1
    ) ${BARCODES_ALIAS} ON TRUE
    ${where}
    ORDER BY ${ALIAS}.product_code ASC, ${ALIAS}.id ASC
    LIMIT ${limit} OFFSET ${offset};
  `;

  // ✅ Count precisa do mesmo JOIN porque o WHERE pode usar p.description e pb.barcode
  const sqlCount = `
    SELECT COUNT(*)::int AS total
    FROM ${TB} ${ALIAS}
    LEFT JOIN ${TB_PRODUCTS} ${PRODUCTS_ALIAS}
      ON ${PRODUCTS_ALIAS}.product_code = ${ALIAS}.product_code
    LEFT JOIN LATERAL (
      -- um único barcode por produto (ativo primeiro): produto com vários
      -- códigos de barras não pode multiplicar a linha da localização
      SELECT pbx."${BARCODE_COL}"
      FROM ${TB_BARCODES} pbx
      WHERE pbx.product_code = ${ALIAS}.product_code
      ORDER BY pbx.is_active DESC NULLS LAST, pbx."${BARCODE_COL}" ASC
      LIMIT 1
    ) ${BARCODES_ALIAS} ON TRUE
    ${where};
  `;

  const client = await pool.connect();
  try {
    const [{ rows }, count] = await Promise.all([
      client.query(sql, params),
      client.query(sqlCount, params),
    ]);

    return {
      rows: rows.map(normalizeRow),
      total: count.rows?.[0]?.total ?? 0,
      limit,
      offset,
    };
  } finally {
    client.release();
  }
}

export async function listByProductCode(product_code, store_id = null) {
  return list({ product_code, store_id, onlyActive: false, limit: 1000, offset: 0 });
}

export async function getById(id) {
  const { rows } = await pool.query(
    `
    SELECT
      ${ALIAS}.id,
      ${ALIAS}.product_code,
      ${PRODUCTS_ALIAS}."${PRODUCT_DESC_COL}" AS product_description,
      ${BARCODES_ALIAS}."${BARCODE_COL}"      AS barcode,
      ${ALIAS}.store_id,
      ${ALIAS}.corredor,
      ${ALIAS}.prateleira,
      ${ALIAS}.bandeja,
      ${ALIAS}.box,
      ${ALIAS}.observacao,
      ${ALIAS}.created_at,
      ${ALIAS}.updated_at,
      ${ALIAS}.is_active,
      -- localização principal do produto (products.product_location_id)
      COALESCE(${PRODUCTS_ALIAS}.product_location_id = ${ALIAS}.id, FALSE) AS is_primary
    FROM ${TB} ${ALIAS}
    LEFT JOIN ${TB_PRODUCTS} ${PRODUCTS_ALIAS}
      ON ${PRODUCTS_ALIAS}.product_code = ${ALIAS}.product_code
    LEFT JOIN LATERAL (
      -- um único barcode por produto (ativo primeiro): produto com vários
      -- códigos de barras não pode multiplicar a linha da localização
      SELECT pbx."${BARCODE_COL}"
      FROM ${TB_BARCODES} pbx
      WHERE pbx.product_code = ${ALIAS}.product_code
      ORDER BY pbx.is_active DESC NULLS LAST, pbx."${BARCODE_COL}" ASC
      LIMIT 1
    ) ${BARCODES_ALIAS} ON TRUE
    WHERE ${ALIAS}.id = $1
    LIMIT 1;
    `,
    [id]
  );

  return rows[0] ? normalizeRow(rows[0]) : null;
}

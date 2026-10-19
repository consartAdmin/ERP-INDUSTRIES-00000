// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBarCodeQuery.repository.js — consultas de códigos de barras  ║
// ║ getByUnitId / getActiveByUnitId / getByProductCode                   ║
// ║ getActiveUnitsByProductCode / getFactorsByProductCodes               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TB_PRODUCTS_BAR_CODE } from './productsBarCode.constants.js';
import { selectProjection } from './productsBarCode.sql.js';

/* ================================================================ */
/* GET BY UNIT ID                                                   */
/* ================================================================ */
export async function getByUnitId(pgPool, product_code, product_unit_id) {
  const { rows } = await pgPool.query(
    `
      SELECT
        ${selectProjection()}
      FROM ${TB_PRODUCTS_BAR_CODE}
      WHERE product_code = $1
        AND product_unit_id = $2
      ORDER BY
        standard DESC NULLS LAST,
        is_active DESC,
        fator ASC NULLS LAST,
        updated_at DESC NULLS LAST,
        created_at DESC
      `,
    [product_code, product_unit_id]
  );

  return rows;
}

/* ================================================================ */
/* GET ACTIVE BY UNIT ID                                            */
/* ================================================================ */
export async function getActiveByUnitId(pgPool, product_code, product_unit_id) {
  const { rows } = await pgPool.query(
    `
      SELECT
        ${selectProjection()}
      FROM ${TB_PRODUCTS_BAR_CODE}
      WHERE product_code = $1
        AND product_unit_id = $2
        AND is_active IS TRUE
      ORDER BY
        standard DESC NULLS LAST,
        fator ASC NULLS LAST,
        updated_at DESC NULLS LAST,
        created_at DESC
      LIMIT 1
      `,
    [product_code, product_unit_id]
  );

  return rows[0] || null;
}

/* ================================================================ */
/* GET BY PRODUCT CODE                                              */
/* ================================================================ */
export async function getByProductCode(pgPool, product_code) {
  const { rows } = await pgPool.query(
    `
      SELECT
        ${selectProjection()}
      FROM ${TB_PRODUCTS_BAR_CODE}
      WHERE product_code = $1
      ORDER BY
        is_active DESC,
        standard DESC NULLS LAST,
        fator ASC NULLS LAST,
        updated_at DESC NULLS LAST,
        created_at DESC
      `,
    [product_code]
  );

  return rows;
}

/* ================================================================ */
/* ACTIVE UNITS BY PRODUCT                                          */
/* ================================================================ */
export async function getActiveUnitsByProductCode(pgPool, product_code) {
  const { rows } = await pgPool.query(
    `
      SELECT
        ${selectProjection('b')},
        b.description AS unit_description,
        p.product_id,
        p.description AS product_description,
        p.is_active AS product_is_active
      FROM ${TB_PRODUCTS_BAR_CODE} b
      JOIN public.products p
        ON p.product_code = b.product_code
      WHERE b.product_code = $1
        AND b.is_active IS TRUE
        AND p.is_active IS TRUE
      ORDER BY
        b.standard DESC NULLS LAST,
        b.fator ASC NULLS LAST,
        b.unit ASC NULLS LAST
      `,
    [product_code]
  );

  return rows.map((row) => ({
    ...row,
    description: row.product_description,
  }));
}

/* ================================================================ */
/* FACTORS BY PRODUCT CODES                                         */
/* ================================================================ */
export async function getFactorsByProductCodes(pgPool, productCodes = []) {
  if (!Array.isArray(productCodes) || !productCodes.length) {
    return [];
  }

  const { rows } = await pgPool.query(
    `
    SELECT DISTINCT ON (
      product_code,
      COALESCE(unit, '')
    )
      product_code,
      product_code AS sku,
      COALESCE(unit, '') AS unit,
      COALESCE(fator, 1) AS factor,
      COALESCE(fator, 1) AS fator,
      COALESCE(standard, FALSE) AS standard
    FROM ${TB_PRODUCTS_BAR_CODE}
    WHERE is_active IS TRUE
      AND product_code = ANY($1::text[])
    ORDER BY
      product_code,
      COALESCE(unit, ''),
      COALESCE(standard, FALSE) DESC,
      barcode_id ASC
    `,
    [productCodes]
  );

  return rows;
}

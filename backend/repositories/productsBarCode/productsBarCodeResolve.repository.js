// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBarCodeResolve.repository.js — resolve                       ║
// ║ Resolve apenas barcode ativo + produto ativo                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TB_PRODUCTS_BAR_CODE } from './productsBarCode.constants.js';
import { selectProjection } from './productsBarCode.sql.js';
import { normalizeBarcode } from './productsBarCode.sanitizers.js';

/* ================================================================ */
/* RESOLVE BARCODE                                                  */
/* ================================================================ */
export async function resolve(pgPool, barcodeRaw) {
  const barcode = normalizeBarcode(barcodeRaw);
  if (!barcode) return null;

  const { rows } = await pgPool.query(
    `
      SELECT
        ${selectProjection('b')},
        b.description AS unit_description,
        p.product_id,
        p.description AS product_description,
        p.cost_price,
        p.sale_price,
        p.is_active AS product_is_active
      FROM ${TB_PRODUCTS_BAR_CODE} b
      JOIN public.products p
        ON p.product_code = b.product_code
      WHERE regexp_replace(b.barcode::text, '\\D', '', 'g') = $1
        AND b.is_active IS TRUE
        AND p.is_active IS TRUE
      ORDER BY
        b.standard DESC NULLS LAST,
        b.updated_at DESC NULLS LAST,
        b.created_at DESC
      LIMIT 1
      `,
    [barcode]
  );

  if (!rows[0]) return null;

  // Compatibility: existing consumers expect product description in `description`.
  return {
    ...rows[0],
    description: rows[0].product_description,
  };
}

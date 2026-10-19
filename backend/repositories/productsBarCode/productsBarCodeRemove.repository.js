// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBarCodeRemove.repository.js — deleteById                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TB_PRODUCTS_BAR_CODE, PK_PRODUCTS_BAR_CODE } from './productsBarCode.constants.js';

/* ================================================================ */
/* DELETE BY ID                                                     */
/* ================================================================ */
export async function deleteById(pgPool, barcode_id) {
  const { rows } = await pgPool.query(
    `
    DELETE FROM ${TB_PRODUCTS_BAR_CODE}
    WHERE ${PK_PRODUCTS_BAR_CODE} = $1
    RETURNING *
    `,
    [barcode_id]
  );

  return rows[0] || null;
}

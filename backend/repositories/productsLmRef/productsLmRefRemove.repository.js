// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsLmRefRemove.repository.js — deleteProductLmRef             ║
// ║ Tabela: public."productsLmRef"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './productsLmRef.constants.js';
import { PRODUCTS_LM_REF_COLUMNS } from './productsLmRef.sql.js';

export async function deleteProductLmRef(productLmRefId) {
  const { rows } = await pool.query(
    `DELETE FROM ${TABLE}
     WHERE product_lm_ref_id = $1
     RETURNING ${PRODUCTS_LM_REF_COLUMNS}`,
    [productLmRefId],
  );

  return rows[0] ?? null;
}

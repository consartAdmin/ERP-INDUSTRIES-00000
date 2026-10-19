// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsLmRefCreate.repository.js — createProductLmRef             ║
// ║ Tabela: public."productsLmRef"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './productsLmRef.constants.js';
import { PRODUCTS_LM_REF_COLUMNS } from './productsLmRef.sql.js';

export async function createProductLmRef({
  supplierId,
  nfProductCode,
  productCode,
  description,
  isActive = true,
}) {
  const { rows } = await pool.query(
    `INSERT INTO ${TABLE} (
       supplier_id,
       nf_product_code,
       product_code,
       description,
       is_active
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${PRODUCTS_LM_REF_COLUMNS}`,
    [supplierId, nfProductCode, productCode, description, isActive],
  );

  return rows[0];
}

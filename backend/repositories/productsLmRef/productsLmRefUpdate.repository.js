// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsLmRefUpdate.repository.js — updateProductLmRef (parcial)   ║
// ║ Tabela: public."productsLmRef"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './productsLmRef.constants.js';
import { PRODUCTS_LM_REF_COLUMNS } from './productsLmRef.sql.js';
import { findProductLmRefById } from './productsLmRefQuery.repository.js';

export async function updateProductLmRef(
  productLmRefId,
  { supplierId, nfProductCode, productCode, description, isActive },
) {
  const fieldMap = {
    supplierId: ['supplier_id', supplierId],
    nfProductCode: ['nf_product_code', nfProductCode],
    productCode: ['product_code', productCode],
    description: ['description', description],
    isActive: ['is_active', isActive],
  };

  const updates = [];
  const values = [];

  for (const [field, [column, value]] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    }
  }

  if (!updates.length) {
    return findProductLmRefById(productLmRefId);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(productLmRefId);

  const { rows } = await pool.query(
    `UPDATE ${TABLE}
     SET ${updates.join(', ')}
     WHERE product_lm_ref_id = $${values.length}
     RETURNING ${PRODUCTS_LM_REF_COLUMNS}`,
    values,
  );

  return rows[0] ?? null;
}

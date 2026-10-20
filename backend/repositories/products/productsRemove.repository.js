// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsRemove.repository.js — softDeleteByCode / restoreByCode      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { PRODUCTS_TABLE, PRODUCTS_SCHEMA } from './products.catalog.js';
import { ProductsApiError } from './products.utils.js';
import { requiredProductCode } from './products.sanitizers.js';
import { ensureItemTypeColumn } from './productsItemType.js';

export async function softDeleteByCode(productCode) {
    return setActiveByCode(productCode, false);
}

export async function restoreByCode(productCode) {
    return setActiveByCode(productCode, true);
}

async function setActiveByCode(productCode, isActive) {
    await ensureItemTypeColumn();
    const code = requiredProductCode(productCode);
    const { rows } = await pool.query(
        `
      UPDATE ${PRODUCTS_TABLE}
      SET is_active = $1,
          updated_at = NOW()
      WHERE product_code = $2
      RETURNING ${PRODUCTS_SCHEMA.selectProjection}
    `,
        [isActive, code],
    );

    if (!rows.length) {
        throw new ProductsApiError('Produto não encontrado.', {
            code: 'PRODUCT_NOT_FOUND',
            status: 404,
        });
    }

    return rows[0];
}

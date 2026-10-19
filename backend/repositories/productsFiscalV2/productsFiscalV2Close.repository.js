// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalV2Close.repository.js — closeCurrent                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import db from '../../config/db.js';
import { PRODUCTS_FISCAL_V2_TABLE as TABLE, PRODUCTS_FISCAL_V2_CURRENT_WHERE_SQL as CURRENT_WHERE } from './productsFiscalV2.catalog.js';
import { RETURNING } from './productsFiscalV2.constants.js';
import { badRequest } from './productsFiscalV2.sanitizers.js';

// ============================================================================
// ENCERRAR VÍNCULO FISCAL ATUAL
// ============================================================================

export async function closeCurrent(productCode) {
  const normalizedProductCode = String(productCode ?? '').trim();
  if (!normalizedProductCode) {
    throw badRequest('productCode é obrigatório.');
  }

  const result = await db.query(
    `
      UPDATE ${TABLE} pf
      SET is_current = false,
          effective_to = now()
      WHERE pf.product_code = $1
        AND ${CURRENT_WHERE}
      RETURNING ${RETURNING}
    `,
    [normalizedProductCode]
  );

  return result.rows[0] ?? null;
}

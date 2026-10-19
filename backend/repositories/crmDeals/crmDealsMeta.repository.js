// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsMeta.repository.js — colunas de customerStatusTypes        ║
// ║ (cache em memória do módulo)                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

/* =========================================================================
 * META / HELPERS — CustomerStatusTypes columns (cache)
 * ========================================================================= */
let _customerStatusTypesColsCache = null;

export async function getCustomerStatusTypesCols() {
  if (_customerStatusTypesColsCache) return _customerStatusTypesColsCache;

  const colsRes = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customerStatusTypes'
  `);

  const cols = new Set((colsRes.rows || []).map((r) => r.column_name));
  _customerStatusTypesColsCache = cols;
  return cols;
}

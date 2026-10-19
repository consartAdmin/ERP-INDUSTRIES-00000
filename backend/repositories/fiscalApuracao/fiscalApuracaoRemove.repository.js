// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalApuracaoRemove.repository.js — deleteFiscalApuracaoById      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_FISCAL_APURACAO } from './fiscalApuracao.constants.js';

/* ======================================================================
   DELETE
   ====================================================================== */

export async function deleteFiscalApuracaoById(
  fiscalApuracaoId,
  client = pool
) {
  const sql = `
    DELETE FROM "${TABLE_FISCAL_APURACAO}"
    WHERE fiscal_apuracao_id = $1
    RETURNING *
  `;

  const { rows } = await client.query(sql, [fiscalApuracaoId]);
  return rows[0] || null;
}

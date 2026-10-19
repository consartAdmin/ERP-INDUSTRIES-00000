// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productFiscalCostRulesRemove.repository.js — remove (soft delete)    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, SELECT_COLUMNS } from './productFiscalCostRules.constants.js';

/* ========================================================================== */
/* Soft Delete                                                                */
/* ========================================================================== */

export async function remove(
  ruleId,
  client = pool,
) {
  const id = Number(ruleId);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const { rows } = await client.query(
    `
      UPDATE ${TB}
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE rule_id = $1
      RETURNING
        ${SELECT_COLUMNS}
    `,
    [id],
  );

  return rows[0] || null;
}

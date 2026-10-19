// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsOutcomesRemove.repository.js — deleteCrmDealsOutcome       ║
// ║ Tabela: "crmDealsOutcomes"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './crmDealsOutcomes.constants.js';
import { normalizeInteger } from './crmDealsOutcomes.sanitizers.js';

export async function deleteCrmDealsOutcome(id) {
  const sql = `
    DELETE FROM ${TABLE}
    WHERE id = $1
    RETURNING id, name, code
  `;

  const { rows } = await pool.query(sql, [normalizeInteger(id, 0)]);
  return rows[0] || null;
}

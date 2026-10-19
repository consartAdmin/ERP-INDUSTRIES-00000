// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalClassificationRemove.repository.js — remove (soft/hard)      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './fiscalClassification.constants.js';

/** "Exclusão" simples — marca como inativo por padrão (soft delete). */
export async function remove(id, { hard = false } = {}) {
  if (hard) {
    await pool.query(`DELETE FROM ${TB} WHERE fiscal_classification_id = $1;`, [Number(id)]);
    return { ok: true, hard: true };
  }
  const { rowCount } = await pool.query(`
    UPDATE ${TB}
    SET is_active = FALSE, updated_at = NOW()
    WHERE fiscal_classification_id = $1
  `, [Number(id)]);
  return { ok: rowCount > 0, hard: false };
}

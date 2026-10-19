// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalProfileRemove.repository.js — remove (soft/hard)             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, nowSql } from './fiscalProfile.constants.js';
import { ensureTable } from './fiscalProfileSchema.repository.js';

export async function remove(id, { hard = false } = {}) {
  await ensureTable();
  if (hard) {
    await pool.query(`DELETE FROM ${TB} WHERE fiscal_profile_id = $1`, [Number(id)]);
    return { ok: true, hard: true };
  }
  await pool.query(
    `UPDATE ${TB}
     SET is_active = FALSE, updated_at = ${nowSql}
     WHERE fiscal_profile_id = $1`,
    [Number(id)],
  );
  return { ok: true, hard: false };
}

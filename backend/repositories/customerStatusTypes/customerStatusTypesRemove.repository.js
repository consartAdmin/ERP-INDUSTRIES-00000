// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusTypesRemove.repository.js — removeById (soft/hard)   ║
// ║ Tabela: public."customerStatusTypes"                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl } from './customerStatusTypes.constants.js';
import { toNumOrNull } from './customerStatusTypes.sanitizers.js';

/** DELETE — soft por padrão (is_active = false) */
export async function removeById(id, { hard = false } = {}) {
  const sid = toNumOrNull(id);
  if (!sid) throw new Error('invalid status type id');

  if (hard) {
    const { rowCount } = await pool.query(`DELETE FROM ${tbl()} WHERE id = $1`, [sid]);
    return { ok: rowCount > 0, hard: true };
  }

  const { rowCount } = await pool.query(
    `UPDATE ${tbl()} SET is_active = FALSE WHERE id = $1`,
    [sid],
  );
  return { ok: rowCount > 0, hard: false };
}

export default removeById;

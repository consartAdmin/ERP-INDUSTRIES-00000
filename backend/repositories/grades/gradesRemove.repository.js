// ╔════════════════════════════════════════════════════════════════════╗
// ║ gradesRemove.repository.js — remove (lógico ou físico)             ║
// ║ Tabela: public."grades"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TFULL, nowSql } from './grades.constants.js';
import { clampInt } from './grades.sanitizers.js';
import { ensureTable } from './gradesSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   remove() — Exclusão lógica ou física
────────────────────────────────────────────────────────────── */
export async function remove(id, { hard = false } = {}) {
  await ensureTable();

  const gradeId = clampInt(id, { min: 1, max: 2_000_000_000 });

  if (hard) {
    await pool.query(`DELETE FROM ${TFULL} WHERE grade_id = $1;`, [gradeId]);
    return { ok: true, hard: true };
  }

  await pool.query(
    `UPDATE ${TFULL} SET is_active = FALSE, updated_at = ${nowSql} WHERE grade_id = $1;`,
    [gradeId]
  );

  return { ok: true, hard: false };
}

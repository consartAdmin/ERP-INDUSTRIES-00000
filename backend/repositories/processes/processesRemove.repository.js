// ╔════════════════════════════════════════════════════════════════════╗
// ║ processesRemove.repository.js — remove (lógico ou físico)          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, nowSql } from './processes.constants.js';
import { ensureTable } from './processesSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   remove() — Exclusão lógica ou física
────────────────────────────────────────────────────────────── */
export async function remove(id, { hard = false } = {}) {
  await ensureTable();
  const numId = Number(id);

  if (hard) {
    await pool.query(`DELETE FROM ${TB} WHERE id = $1`, [numId]);
    return { ok: true, hard: true };
  }

  await pool.query(
    `
      UPDATE ${TB}
      SET deleted_at = ${nowSql}, status = 'inativo', updated_at = ${nowSql}
      WHERE id = $1
    `,
    [numId]
  );

  return { ok: true, hard: false };
}

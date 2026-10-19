// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGradesRemove.repository.js — remove                        ║
// ║ Tabela: public."productsGrades"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './productsGrades.constants.js';
import { ensureTable } from './productsGradesSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   REMOVE
────────────────────────────────────────────────────────────── */
export async function remove(id) {
  await ensureTable();

  await pool.query(
    `DELETE FROM ${TB} WHERE product_grade_id = $1`,
    [Number(id)]
  );

  return { ok: true };
}

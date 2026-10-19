// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsSubgroupsRemove.repository.js — remover (hard delete)      ║
// ║ Tabela: public."productsSubgroups"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, COLS } from './productsSubgroups.constants.js';

// ──────────────────────────────────────────────────────────────────────────────
/** Remover (hard delete) */
// ──────────────────────────────────────────────────────────────────────────────
export async function deleteProductsSubgroup(id) {
  const res = await pool.query(`DELETE FROM public.${TB} WHERE ${COLS.id} = $1 RETURNING ${COLS.id};`, [id]);
  return res.rowCount > 0;
}

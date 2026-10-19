// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGroupsRemove.repository.js — delete (hard)                 ║
// ║ Tabela: public."productsGroups"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, COLS } from './productsGroups.constants.js';

// ──────────────────────────────────────────────────────────────────────────────
// Delete (hard)
// ──────────────────────────────────────────────────────────────────────────────
export async function deleteProductsGroup(id) {
  const res = await pool.query(
    `
      DELETE FROM public.${TB}
      WHERE ${COLS.id} = $1
      RETURNING ${COLS.id};
    `,
    [id],
  );
  return res.rowCount > 0;
}

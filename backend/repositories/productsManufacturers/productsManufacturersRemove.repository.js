// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsManufacturersRemove.repository.js — delete (hard)          ║
// ║ Tabela: public."productsManufactures"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, COLS } from './productsManufacturers.constants.js';

// ──────────────────────────────────────────────────────────────────────────────
// Delete (hard)
// ──────────────────────────────────────────────────────────────────────────────
export async function deleteProductsManufacturer(id) {
  const res = await pool.query(
    `
      DELETE FROM public.${TB}
      WHERE ${COLS.id} = $1
      RETURNING ${COLS.id};
    `,
    [id]
  );
  return res.rowCount > 0;
}

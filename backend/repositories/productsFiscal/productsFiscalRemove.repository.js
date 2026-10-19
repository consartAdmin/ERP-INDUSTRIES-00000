// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalRemove.repository.js — softDelete (DELETE real)      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './productsFiscal.constants.js';
import { rowToModel } from './productsFiscal.mappers.js';

// ✅ DELETE REAL (remove a linha do banco)
export async function softDelete(id) {
  const { rows } = await pool.query(
    `DELETE FROM ${TB}
     WHERE products_fiscal_id = $1
     RETURNING *;`,
    [Number(id)]
  );
  return rowToModel(rows[0]);
}

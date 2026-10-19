// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellersRemove.repository.js — remove (soft delete: active=false)   ║
// ║ Tabela: public."sellers"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl } from './sellers.constants.js';
import { rowToModel } from './sellers.mappers.js';

export async function remove(id) {
  const { rows } = await pool.query(
    `
    UPDATE ${tbl()}
    SET active = FALSE, updated_at = NOW()
    WHERE id = $1
    RETURNING *;
    `,
    [Number(id)]
  );
  return rowToModel(rows[0]);
}

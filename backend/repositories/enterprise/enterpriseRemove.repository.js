// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterpriseRemove.repository.js — remove                              ║
// ║ Tabela: enterprises                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { catalog_schema } from './enterprise.constants.js';
import { ensureTable } from './enterpriseSchema.repository.js';

export async function remove(id) {
  await ensureTable();

  const { rowCount } = await pool.query(`
    DELETE FROM ${catalog_schema.table}
    WHERE id = $1
  `, [id]);

  return rowCount > 0;
}

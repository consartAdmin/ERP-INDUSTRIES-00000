// ╔══════════════════════════════════════════════════════════════════════╗
// ║ pdv_loginsRemove.repository.js — remove                              ║
// ║ Tabela: public.pdv_logins                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './pdv_logins.constants.js';

export async function remove(id) {
  const result = await pool.query(
    `DELETE FROM ${TABLE} WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rowCount > 0;
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByUserSchema.repository.js — ensureTables                    ║
// ║ Tabela: public."sellerByUser"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { DDL, DDL_TRIGGER } from './sellerByUser.schema.js';

export async function ensureTables() {
  await pool.query('BEGIN');
  try {
    await pool.query(DDL);
    await pool.query(DDL_TRIGGER);
    await pool.query('COMMIT');
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
}

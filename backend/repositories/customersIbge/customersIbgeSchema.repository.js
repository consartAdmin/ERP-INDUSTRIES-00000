// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersIbgeSchema.repository.js — ensureTable / ensureTables     ║
// ║ Roda o DDL de public."customersIbge" em uma transação.             ║
// ║ Obs: em erro retorna { ok:false } (não lança).                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { DDL } from './customersIbge.schema.js';

export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(DDL.customersIbge);
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}

// compat com seu padrão “ensureTables”
export async function ensureTables() {
  return ensureTable();
}

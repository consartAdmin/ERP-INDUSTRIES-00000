// ╔════════════════════════════════════════════════════════════════════╗
// ║ priceCommissionsSchema.repository.js — ensureTables (idempotente)  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { DDL } from './priceCommissions.schema.js';

export async function ensureTables() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(DDL);
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    return { ok: false, error: String(err?.message || err) };
  } finally {
    client.release();
  }
}

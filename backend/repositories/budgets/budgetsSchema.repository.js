// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsSchema.repository.js — ensureTables                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

// ----------------------------------------------------------------------
// Ensure tables
// ----------------------------------------------------------------------
export async function ensureTables() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(DDL.budgets);
    await client.query(DDL.budget_items);
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    return { ok: false, error: String(err?.message || err) };
  } finally {
    client.release();
  }
}

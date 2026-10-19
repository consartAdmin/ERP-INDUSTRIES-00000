// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssued.utils.js — NF-e Bonificação                            ║
// ║ Helper de transação (BEGIN/COMMIT/ROLLBACK)                           ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';


export async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');

    throw error;
  } finally {
    client.release();
  }
}

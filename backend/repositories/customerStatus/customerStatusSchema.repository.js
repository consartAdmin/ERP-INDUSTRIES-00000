// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusSchema.repository.js — ensureTable                   ║
// ║ Roda o DDL de public."customerStatus" em uma transação.            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ensureCustomerStatusTable } from './customerStatus.schema.js';

/** Cria tabela e índices (idempotente) */
export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await ensureCustomerStatusTable(client);

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default ensureTable;

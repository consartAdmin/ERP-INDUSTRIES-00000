// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusTypesSchema.repository.js — ensureTable              ║
// ║ Roda o DDL de public."customerStatusTypes" em uma transação.       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ensureCustomerStatusTypesTable } from './customerStatusTypes.schema.js';

/** Cria tabela e índices (idempotente) */
export async function ensureTable() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await ensureCustomerStatusTypesTable(client);

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[customerStatusTypesApi.ensureTable] error:', err);
    throw err;
  } finally {
    client.release();
  }
}

export default ensureTable;

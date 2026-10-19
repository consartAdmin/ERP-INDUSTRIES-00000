// ╔════════════════════════════════════════════════════════════════════╗
// ║ modulePasswordsSchema.repository.js — ensureTable / ready          ║
// ║ Criação preguiçosa (memoizada) de public."modulePasswords"         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ensureModulePasswordsTable } from './modulePasswords.schema.js';

/** Cria tabela, índices e catálogo (idempotente) */
export async function ensureTable() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureModulePasswordsTable(client);
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[modulePasswords.ensureTable] error:', err);
    throw err;
  } finally {
    client.release();
  }
}

let tableReady = null;

export function ready() {
  if (!tableReady) {
    tableReady = ensureTable().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

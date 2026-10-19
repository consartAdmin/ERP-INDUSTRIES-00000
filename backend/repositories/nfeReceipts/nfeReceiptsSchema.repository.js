// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsSchema.repository.js — ensureTable / ensureReady        ║
// ║ ensureTable: roda o DDL em uma transação (endpoint /ensure-table). ║
// ║ ensureReady: mesmo DDL, mas só UMA vez por processo — usado antes  ║
// ║ das consultas, sem repetir o DDL a cada request.                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ensureNfeReceiptsTable } from './nfeReceipts.schema.js';

// Ordem importa: tabelas referenciadas por FK vêm antes.
const STEPS = [
  ensureNfeReceiptsTable,
];

export async function ensureTable() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const step of STEPS) {
      await step(client);
    }

    await client.query('COMMIT');

    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

let readyPromise = null;

export function ensureReady() {
  if (!readyPromise) {
    readyPromise = ensureTable().catch((err) => {
      // Permite nova tentativa na próxima chamada se o DDL falhar.
      readyPromise = null;
      throw err;
    });
  }

  return readyPromise;
}

export default ensureTable;

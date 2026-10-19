// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableDb.repository.js — Execução no banco             ║
// ║ runPersistenceQuery (com log) / withTransaction                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { persistenceDiagnostic, postgresErrorDiagnostic } from './accountsReceivable.utils.js';

export async function runPersistenceQuery(operation, sql, params, context, executor = pool) {
  console.info(`[AR:PERSIST:${operation}] request`, context);

  try {
    const { rows } = await executor.query(sql, params);
    console.info(
      `[AR:PERSIST:${operation}] database-result`,
      rows[0]
        ? { id: rows[0].id, ...persistenceDiagnostic(rows[0]) }
        : { row: null }
    );
    return rows;
  } catch (error) {
    console.error(
      `[AR:PERSIST:${operation}] postgres-error`,
      postgresErrorDiagnostic(error)
    );
    throw error;
  }
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

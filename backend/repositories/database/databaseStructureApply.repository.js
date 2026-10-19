// ╔════════════════════════════════════════════════════════════════════╗
// ║ databaseStructureApply.repository.js                               ║
// ║ previewStructureChange / applyStructureChange                      ║
// ║ Aplica o DDL em transação + registro em auditLogs                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { createAuditLog } from '../auditLogs/auditLogs.index.js';
import { DEFAULT_SCHEMA } from './database.constants.js';
import { buildStructureSql } from './databaseStructure.builders.js';
import { getTableStructure } from './databaseStructure.repository.js';

export async function previewStructureChange({ schema = DEFAULT_SCHEMA, table, operation }) {
  const structure = await getTableStructure({ schema, table });

  return {
    operation,
    statements: buildStructureSql(operation, structure),
  };
}

export async function applyStructureChange({ schema = DEFAULT_SCHEMA, table, operation, userId = null }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    // Não segura a tabela indefinidamente se houver outra transação usando-a
    await client.query("SET LOCAL lock_timeout = '5s'");

    const before = await getTableStructure({ schema, table, db: client });
    const statements = buildStructureSql(operation, before);

    for (const sql of statements) {
      await client.query(sql);
    }

    await createAuditLog({
      tabela: `${before.schema}.${before.table}`,
      operation: `DDL_${String(operation.type).toUpperCase().replace('.', '_')}`,
      user_id: userId,
      before: { operation },
      after: { statements },
      db: client,
    });

    await client.query('COMMIT');

    return {
      statements,
      structure: await getTableStructure({ schema, table }),
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});

    // Erros do PostgreSQL (ex.: FK violada, PK duplicada) voltam como 400 com a mensagem original
    if (err.code && !err.status) {
      err.status = 400;
      err.message = `PostgreSQL: ${err.message}${err.detail ? ` — ${err.detail}` : ''}`;
    }

    throw err;
  } finally {
    client.release();
  }
}

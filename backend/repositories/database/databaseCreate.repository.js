// ╔════════════════════════════════════════════════════════════════════╗
// ║ databaseCreate.repository.js — insertRow                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { DEFAULT_SCHEMA } from './database.constants.js';
import { assertSafeIdentifier, quoteIdent, assertTableAllowed } from './database.sanitizers.js';
import { getTableColumns } from './databaseSchema.repository.js';

export async function insertRow({ schema = DEFAULT_SCHEMA, table, data }) {
  const schemaName = assertSafeIdentifier(schema, 'Schema');
  const tableName = assertTableAllowed(table);

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    const err = new Error('Dados inválidos para inserção.');
    err.status = 400;
    throw err;
  }

  const columnsInfo = await getTableColumns({ schema: schemaName, table: tableName });
  const allowedColumns = new Set(columnsInfo.columns.map((c) => c.column_name));

  const entries = Object.entries(data).filter(([key]) => allowedColumns.has(key));

  if (!entries.length) {
    const err = new Error('Nenhuma coluna válida enviada.');
    err.status = 400;
    throw err;
  }

  const cols = entries.map(([key]) => quoteIdent(key));
  const params = entries.map(([, value]) => value);
  const placeholders = params.map((_, i) => `$${i + 1}`);

  const fullTable = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;

  const sql = `
    INSERT INTO ${fullTable} (${cols.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `;

  const { rows } = await pool.query(sql, params);
  return rows[0];
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ databaseRemove.repository.js — deleteRow (por chave primária)      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { DEFAULT_SCHEMA } from './database.constants.js';
import { assertSafeIdentifier, quoteIdent, assertTableAllowed } from './database.sanitizers.js';
import { getTableColumns } from './databaseSchema.repository.js';

export async function deleteRow({ schema = DEFAULT_SCHEMA, table, pk }) {
  const schemaName = assertSafeIdentifier(schema, 'Schema');
  const tableName = assertTableAllowed(table);

  const columnsInfo = await getTableColumns({ schema: schemaName, table: tableName });
  const pkColumns = columnsInfo.primaryKey;

  if (!pkColumns.length) {
    const err = new Error('Esta tabela não possui chave primária. Exclusão bloqueada.');
    err.status = 400;
    throw err;
  }

  const params = [];
  const whereSql = pkColumns.map((col) => {
    if (!(col in pk)) {
      const err = new Error(`Chave primária incompleta. Campo ausente: ${col}`);
      err.status = 400;
      throw err;
    }

    params.push(pk[col]);
    return `${quoteIdent(col)} = $${params.length}`;
  });

  const fullTable = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;

  const sql = `
    DELETE FROM ${fullTable}
    WHERE ${whereSql.join(' AND ')}
    RETURNING *
  `;

  const { rows } = await pool.query(sql, params);

  if (!rows.length) {
    const err = new Error('Registro não encontrado para exclusão.');
    err.status = 404;
    throw err;
  }

  return rows[0];
}

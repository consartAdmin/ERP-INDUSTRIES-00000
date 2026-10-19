// ╔════════════════════════════════════════════════════════════════════╗
// ║ databaseUpdate.repository.js — updateRow (por chave primária)      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { DEFAULT_SCHEMA } from './database.constants.js';
import { assertSafeIdentifier, quoteIdent, assertTableAllowed } from './database.sanitizers.js';
import { getTableColumns } from './databaseSchema.repository.js';

export async function updateRow({ schema = DEFAULT_SCHEMA, table, pk, data }) {
  const schemaName = assertSafeIdentifier(schema, 'Schema');
  const tableName = assertTableAllowed(table);

  if (!pk || typeof pk !== 'object') {
    const err = new Error('Chave primária inválida.');
    err.status = 400;
    throw err;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    const err = new Error('Dados inválidos para atualização.');
    err.status = 400;
    throw err;
  }

  const columnsInfo = await getTableColumns({ schema: schemaName, table: tableName });
  const allowedColumns = new Set(columnsInfo.columns.map((c) => c.column_name));

  const pkColumns = columnsInfo.primaryKey;

  if (!pkColumns.length) {
    const err = new Error('Esta tabela não possui chave primária. Edição bloqueada.');
    err.status = 400;
    throw err;
  }

  for (const col of pkColumns) {
    if (!(col in pk)) {
      const err = new Error(`Chave primária incompleta. Campo ausente: ${col}`);
      err.status = 400;
      throw err;
    }
  }

  // Colunas da PK também podem ser alteradas: o WHERE usa o valor original (pk)
  const entries = Object.entries(data).filter(([key]) => allowedColumns.has(key));

  if (!entries.length) {
    const err = new Error('Nenhuma coluna válida para atualizar.');
    err.status = 400;
    throw err;
  }

  const params = [];
  const setSql = entries.map(([key, value], index) => {
    params.push(value);
    return `${quoteIdent(key)} = $${index + 1}`;
  });

  const whereSql = pkColumns.map((col) => {
    params.push(pk[col]);
    return `${quoteIdent(col)} = $${params.length}`;
  });

  const fullTable = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;

  const sql = `
    UPDATE ${fullTable}
    SET ${setSql.join(', ')}
    WHERE ${whereSql.join(' AND ')}
    RETURNING *
  `;

  const { rows } = await pool.query(sql, params);

  if (!rows.length) {
    const err = new Error('Registro não encontrado para atualização.');
    err.status = 404;
    throw err;
  }

  return rows[0];
}

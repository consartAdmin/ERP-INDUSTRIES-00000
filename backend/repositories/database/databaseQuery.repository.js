// ╔════════════════════════════════════════════════════════════════════╗
// ║ databaseQuery.repository.js — countTableRows / getTableRows        ║
// ║ (leitura paginada de qualquer tabela permitida)                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { DEFAULT_SCHEMA } from './database.constants.js';
import { assertSafeIdentifier, quoteIdent, assertTableAllowed } from './database.sanitizers.js';
import { getTableColumns } from './databaseSchema.repository.js';

export async function countTableRows({ schema = DEFAULT_SCHEMA, table, search = '' }) {
  const schemaName = assertSafeIdentifier(schema, 'Schema');
  const tableName = assertTableAllowed(table);

  const fullTable = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;

  let sql = `SELECT COUNT(*)::bigint AS total FROM ${fullTable}`;
  const params = [];

  if (search) {
    const columns = await getTableColumns({ schema: schemaName, table: tableName });
    const textColumns = columns.columns.filter((c) =>
      ['character varying', 'text', 'char', 'uuid'].includes(c.data_type)
    );

    if (textColumns.length) {
      params.push(`%${search}%`);
      const where = textColumns
        .map((c) => `${quoteIdent(c.column_name)}::text ILIKE $1`)
        .join(' OR ');
      sql += ` WHERE ${where}`;
    }
  }

  const { rows } = await pool.query(sql, params);
  return Number(rows[0]?.total || 0);
}

export async function getTableRows({
  schema = DEFAULT_SCHEMA,
  table,
  page = 1,
  limit = 50,
  search = '',
  orderBy = '',
  orderDir = 'ASC',
}) {
  const schemaName = assertSafeIdentifier(schema, 'Schema');
  const tableName = assertTableAllowed(table);

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const offset = (safePage - 1) * safeLimit;

  const columnsInfo = await getTableColumns({ schema: schemaName, table: tableName });
  const columnNames = columnsInfo.columns.map((c) => c.column_name);

  const fullTable = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;

  const params = [];
  let whereSql = '';

  if (search) {
    const textColumns = columnsInfo.columns.filter((c) =>
      ['character varying', 'text', 'char', 'uuid'].includes(c.data_type)
    );

    if (textColumns.length) {
      params.push(`%${search}%`);
      whereSql = `WHERE ${textColumns
        .map((c) => `${quoteIdent(c.column_name)}::text ILIKE $1`)
        .join(' OR ')}`;
    }
  }

  let orderSql = '';
  if (orderBy && columnNames.includes(orderBy)) {
    const dir = String(orderDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    orderSql = `ORDER BY ${quoteIdent(orderBy)} ${dir}`;
  } else if (columnsInfo.primaryKey.length) {
    orderSql = `ORDER BY ${quoteIdent(columnsInfo.primaryKey[0])} ASC`;
  }

  params.push(safeLimit, offset);

  const sql = `
    SELECT *
    FROM ${fullTable}
    ${whereSql}
    ${orderSql}
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
  `;

  const { rows } = await pool.query(sql, params);
  const total = await countTableRows({ schema: schemaName, table: tableName, search });

  return {
    schema: schemaName,
    table: tableName,
    page: safePage,
    limit: safeLimit,
    total,
    primaryKey: columnsInfo.primaryKey,
    columns: columnsInfo.columns,
    rows,
  };
}

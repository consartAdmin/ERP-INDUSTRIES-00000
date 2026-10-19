// ╔════════════════════════════════════════════════════════════════════╗
// ║ databaseSchema.repository.js — metadados (information_schema):     ║
// ║ getPrimaryKey / listTables / getTableColumns                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { DEFAULT_SCHEMA, BLOCKED_TABLES } from './database.constants.js';
import { assertSafeIdentifier, assertTableAllowed } from './database.sanitizers.js';

export async function getPrimaryKey(schemaName, tableName) {

  const sql = `
    SELECT
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = $1
      AND tc.table_name = $2
    ORDER BY kcu.ordinal_position
  `;

  const { rows } = await pool.query(sql, [
    schemaName,
    tableName
  ]);

  return rows.map(r => r.column_name);
}

export async function listTables({ schema = DEFAULT_SCHEMA } = {}) {
  const schemaName = assertSafeIdentifier(schema, 'Schema');

  const sql = `
    SELECT
      table_schema,
      table_name,
      table_type
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `;

  const { rows } = await pool.query(sql, [schemaName]);

  return rows.filter((r) => !BLOCKED_TABLES.has(r.table_name));
}

export async function getTableColumns({ schema = DEFAULT_SCHEMA, table }) {
  const schemaName = assertSafeIdentifier(schema, 'Schema');
  const tableName = assertTableAllowed(table);

  const sql = `
    SELECT
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      ordinal_position
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
    ORDER BY ordinal_position ASC
  `;

  const { rows } = await pool.query(sql, [schemaName, tableName]);
  const primaryKey = await getPrimaryKey(schemaName, tableName);

  return {
    schema: schemaName,
    table: tableName,
    primaryKey,
    columns: rows,
  };
}

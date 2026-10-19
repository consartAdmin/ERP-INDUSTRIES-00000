// ╔════════════════════════════════════════════════════════════════════╗
// ║ databaseStructure.repository.js — getTableStructure                ║
// ║ Colunas, PK, FKs, UNIQUE/CHECK e índices (pg_catalog)              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { DEFAULT_SCHEMA, FK_ACTION_CODES } from './database.constants.js';
import { assertSafeIdentifier, assertTableAllowed } from './database.sanitizers.js';

const COLUMNS_SQL = `
  SELECT
    a.attname::text                          AS column_name,
    format_type(a.atttypid, a.atttypmod)     AS data_type,
    NOT a.attnotnull                         AS is_nullable,
    pg_get_expr(d.adbin, d.adrelid)          AS column_default,
    a.attidentity <> ''                      AS is_identity,
    a.attnum                                 AS ordinal_position
  FROM pg_attribute a
  JOIN pg_class c      ON c.oid = a.attrelid
  JOIN pg_namespace n  ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE n.nspname = $1
    AND c.relname = $2
    AND a.attnum > 0
    AND NOT a.attisdropped
  ORDER BY a.attnum
`;

const CONSTRAINTS_SQL = `
  SELECT
    con.conname::text                        AS name,
    con.contype                              AS type,
    pg_get_constraintdef(con.oid)            AS definition,
    ARRAY(
      SELECT att.attname::text
      FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
      ORDER BY k.ord
    )                                        AS columns,
    fn.nspname::text                         AS ref_schema,
    fc.relname::text                         AS ref_table,
    ARRAY(
      SELECT att.attname::text
      FROM unnest(con.confkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = k.attnum
      ORDER BY k.ord
    )                                        AS ref_columns,
    con.confupdtype                          AS on_update,
    con.confdeltype                          AS on_delete
  FROM pg_constraint con
  JOIN pg_class c      ON c.oid = con.conrelid
  JOIN pg_namespace n  ON n.oid = c.relnamespace
  LEFT JOIN pg_class fc     ON fc.oid = con.confrelid
  LEFT JOIN pg_namespace fn ON fn.oid = fc.relnamespace
  WHERE n.nspname = $1
    AND c.relname = $2
    AND con.contype IN ('p', 'f', 'u', 'c')
  ORDER BY con.contype, con.conname
`;

const INDEXES_SQL = `
  SELECT
    i.relname::text                          AS name,
    ix.indisunique                           AS is_unique,
    ix.indisprimary                          AS is_primary,
    pg_get_indexdef(ix.indexrelid)           AS definition,
    con.conname::text                        AS constraint_name
  FROM pg_index ix
  JOIN pg_class i      ON i.oid = ix.indexrelid
  JOIN pg_class c      ON c.oid = ix.indrelid
  JOIN pg_namespace n  ON n.oid = c.relnamespace
  LEFT JOIN pg_constraint con
    ON con.conindid = ix.indexrelid
   AND con.conrelid = c.oid
   AND con.contype IN ('p', 'u', 'x')
  WHERE n.nspname = $1
    AND c.relname = $2
  ORDER BY ix.indisprimary DESC, i.relname
`;

const REFERENCED_BY_SQL = `
  SELECT
    con.conname::text                        AS name,
    n.nspname::text                          AS schema,
    c.relname::text                          AS table,
    pg_get_constraintdef(con.oid)            AS definition
  FROM pg_constraint con
  JOIN pg_class c      ON c.oid = con.conrelid
  JOIN pg_namespace n  ON n.oid = c.relnamespace
  JOIN pg_class fc     ON fc.oid = con.confrelid
  JOIN pg_namespace fn ON fn.oid = fc.relnamespace
  WHERE con.contype = 'f'
    AND fn.nspname = $1
    AND fc.relname = $2
  ORDER BY c.relname, con.conname
`;

function mapConstraint(row) {
  return {
    name: row.name,
    definition: row.definition,
    columns: row.columns || [],
  };
}

export async function getTableStructure({ schema = DEFAULT_SCHEMA, table, db = pool }) {
  const schemaName = assertSafeIdentifier(schema, 'Schema');
  const tableName = assertTableAllowed(table);
  const params = [schemaName, tableName];

  const [columns, constraints, indexes, referencedBy] = await Promise.all([
    db.query(COLUMNS_SQL, params),
    db.query(CONSTRAINTS_SQL, params),
    db.query(INDEXES_SQL, params),
    db.query(REFERENCED_BY_SQL, params),
  ]);

  if (!columns.rows.length) {
    const err = new Error(`Tabela não encontrada: ${schemaName}.${tableName}`);
    err.status = 404;
    throw err;
  }

  const pkRow = constraints.rows.find((r) => r.type === 'p');

  return {
    schema: schemaName,
    table: tableName,
    columns: columns.rows,
    primaryKey: pkRow ? mapConstraint(pkRow) : null,
    foreignKeys: constraints.rows
      .filter((r) => r.type === 'f')
      .map((r) => ({
        ...mapConstraint(r),
        refSchema: r.ref_schema,
        refTable: r.ref_table,
        refColumns: r.ref_columns || [],
        onUpdate: FK_ACTION_CODES[r.on_update] || 'NO ACTION',
        onDelete: FK_ACTION_CODES[r.on_delete] || 'NO ACTION',
      })),
    uniques: constraints.rows.filter((r) => r.type === 'u').map(mapConstraint),
    checks: constraints.rows.filter((r) => r.type === 'c').map(mapConstraint),
    indexes: indexes.rows.map((r) => ({
      name: r.name,
      definition: r.definition,
      isUnique: r.is_unique,
      isPrimary: r.is_primary,
      constraintName: r.constraint_name,
    })),
    referencedBy: referencedBy.rows,
  };
}

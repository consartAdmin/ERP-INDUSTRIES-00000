// ╔════════════════════════════════════════════════════════════════════╗
// ║ licitationsDiagnose.repository.js — diagnóstico da conexão/tabela  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_NAME } from './licitations.constants.js';

export async function diagnoseLicitationsDatabase() {
    const connection = await pool.query(`
    SELECT
      current_database() AS database_name,
      current_schema() AS current_schema,
      current_user AS database_user
  `);

    const relations = await pool.query(`
    SELECT
      n.nspname AS schema_name,
      c.relname AS relation_name,
      c.relkind AS relation_kind
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n
      ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND LOWER(c.relname) IN ('licitationitems', 'licitation_items')
    ORDER BY c.relname
  `);

    return {
        connection: connection.rows[0] || null,
        relations: relations.rows,
        configured_table: TABLE_NAME,
    };
}

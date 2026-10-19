// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersSchema.repository.js — ensureTable() de public.users          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { SCHEMA, COLUMNS, INDEXES, TB, ALL_COLS } from './users.constants.js';

/* ─────────────────────── ensureTable() ──────────────────────────── */

/** Converte o default do catálogo em SQL (strings já são expressões SQL) */
function sqlDefault(v) {
  if (v === null || v === undefined) return null;
  return String(v);
}

/** Gera a definição SQL de uma coluna a partir do catálogo */
function columnDDL(name, col) {
  const type = col.length ? `${col.type}(${col.length})` : col.type;
  const parts = [`${name} ${type}`];
  const def = sqlDefault(col.default);
  if (def !== null) parts.push(`DEFAULT ${def}`);
  if (!col.nullable) parts.push('NOT NULL');
  return parts.join(' ');
}

/**
 * Garante a existência da tabela public."users", conforme catalog_schema.users.js.
 * Não derruba nada existente, só cria se não existir.
 *
 * IMPORTANTE:
 * - Se sua tabela já existe com outra estrutura, essa criação será ignorada.
 * - Se quiser evoluir colunas, use migrações/ALTER TABLE separado.
 */
export async function ensureTable() {
  const sequences = ALL_COLS
    .map((c) => COLUMNS[c].sequence)
    .filter(Boolean)
    .map((seq) => `CREATE SEQUENCE IF NOT EXISTS ${SCHEMA}.${seq};`);

  const columnDefs = ALL_COLS.map((c) => columnDDL(c, COLUMNS[c]));

  const constraintDefs = INDEXES
    .filter((i) => i.constraint && i.unique)
    .map((i) => `CONSTRAINT ${i.name} UNIQUE (${i.columns.join(', ')})`);

  const indexDefs = INDEXES
    .filter((i) => !i.constraint)
    .map(
      (i) =>
        `CREATE ${i.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${i.name} ` +
        `ON ${TB} USING ${i.type} (${i.columns.join(', ')});`
    );

  const sql = `
    ${sequences.join('\n    ')}

    CREATE TABLE IF NOT EXISTS ${TB} (
      ${[...columnDefs, ...constraintDefs].join(',\n      ')}
    );

    ${indexDefs.join('\n    ')}
  `;
  await pool.query(sql);
}

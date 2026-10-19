// ╔════════════════════════════════════════════════════════════════════╗
// ║ chartOfAccounts.constants.js — Tabela, PK e listas de colunas      ║
// ║ Tabela: public."chartOfAccounts" (chartOfAccounts.catalog.js)      ║
// ╚════════════════════════════════════════════════════════════════════╝

import catalog from './chartOfAccounts.catalog.js';

/* ─────────────────────────── Catalog ─────────────────────────── */

export const {
  schema: SCHEMA,
  table: TABLE_NAME,
  columns: COLUMNS,
  indexes: INDEXES,
  checks: CHECKS,
  foreignKeys: FOREIGN_KEYS,
  triggers: TRIGGERS,
} = catalog;

/** Quotes a SQL identifier (the table and some constraint names are case-sensitive) */
export const qi = (name) => `"${String(name).replace(/"/g, '""')}"`;

export const TABLE = `${SCHEMA}.${qi(TABLE_NAME)}`;
export const PK = catalog.primaryKey;

/** All columns, in catalog order */
export const ALL_COLS = Object.keys(COLUMNS);

/** Columns written by create/update (excludes id, created_at, updated_at) */
export const WRITABLE_COLS = ALL_COLS.filter((c) => !COLUMNS[c].readOnly);

/** Lighter column sets for search and posting-account lookups */
export const TIMESTAMP_COLS = ['created_at', 'updated_at'];
export const SEARCH_COLS = ALL_COLS.filter((c) => !TIMESTAMP_COLS.includes(c));
export const POSTING_COLS = SEARCH_COLS.filter((c) => c !== 'notes');

/** Sortable columns (everything except free text) */
export const SORT_MAP = Object.fromEntries(
  ALL_COLS.filter((c) => COLUMNS[c].type !== 'text').map((c) => [c, `coa.${c}`])
);

// ╔════════════════════════════════════════════════════════════════════╗
// ║ users.constants.js — Tabela, alias e listas de colunas de users    ║
// ║ Tabela: public.users (definida em users.catalog.js)                ║
// ╚════════════════════════════════════════════════════════════════════╝

import catalog from './users.catalog.js';

/* ─────────────────────────── Catálogo ─────────────────────────── */

export const { schema: SCHEMA, table: TABLE, columns: COLUMNS, indexes: INDEXES } = catalog;

export const TB = `${SCHEMA}."${TABLE}"`;
export const ALIAS = 'u';
export const PK = catalog.primaryKey; // user_id

/** Todas as colunas, na ordem do catálogo */
export const ALL_COLS = Object.keys(COLUMNS);

/** Colunas que a API pode gravar (exclui user_id e created_at) */
export const WRITABLE_COLS = ALL_COLS.filter((c) => !COLUMNS[c].readOnly);

/** Colunas permitidas para ordenação (exclui colunas sensíveis) */
export const SORT_COLS = new Set(ALL_COLS.filter((c) => !COLUMNS[c].sensitive));

/** Defaults aplicados pela aplicação no create (o banco não tem default para access_level) */
export const APP_DEFAULTS = {
  access_level: 'User',
  is_active: true,
};

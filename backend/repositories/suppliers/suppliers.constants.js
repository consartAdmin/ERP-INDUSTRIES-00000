// ╔══════════════════════════════════════════════════════════════════════╗
// ║ suppliers.constants.js — tabela, alias e colunas de retorno          ║
// ║ Tabela alvo: public."suppliers"                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { SUPPLIERS_TABLE, SUPPLIERS_SCHEMA } from './suppliers.catalog.js';

/* ──────────────────────────────────────────────────────────────
   Tabela & Alias
────────────────────────────────────────────────────────────── */
export const TB = SUPPLIERS_TABLE;
export const ALIAS = SUPPLIERS_SCHEMA.alias;

export const RETURNING_COLUMNS = SUPPLIERS_SCHEMA.selectColumns
  .map((column) => `        ${column}`)
  .join(',\n');

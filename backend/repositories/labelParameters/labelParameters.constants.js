// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelParameters.constants.js — Tabelas e colunas graváveis          ║
// ╚══════════════════════════════════════════════════════════════════════╝

// Tabela real no Postgres
export const LABEL_PARAMETERS_TABLE = 'public."labelParameters"';

// Price tables used by Labels module
export const PRICES_TABLE = 'public.prices';
export const PRODUCTS_PRICES_TABLE = 'public."productsPrices"';

/* ======================================================================
   WRITABLE COLUMNS
   ====================================================================== */

export const WRITABLE_COLUMNS = [
  'user_id',
  'name',
  'page_width_mm',
  'page_height_mm',
  'label_width_mm',
  'label_height_mm',
  'active',
  'layout_json',
];

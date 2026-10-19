// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsManufacturers.constants.js — Tabela, alias e colunas       ║
// ║ Tabela: public."productsManufactures" (alias: pmf)                 ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB    = '"productsManufactures"';
export const ALIAS = 'pmf';

export const COLS = Object.freeze({
  id:         'product_manufacturer_id',
  name:       'name',
  created_at: 'created_at',
  updated_at: 'updated_at',
  is_active:  'is_active',
});

export const ORDERABLE = new Set([COLS.name, COLS.created_at, COLS.updated_at, COLS.is_active]);

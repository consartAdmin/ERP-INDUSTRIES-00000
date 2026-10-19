// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGroups.constants.js — Tabela, alias e colunas dos grupos   ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB    = '"productsGroups"';
export const ALIAS = 'pg';

export const COLS = Object.freeze({
  id:         'product_group_id',
  name:       'name',
  created_at: 'created_at',
  updated_at: 'updated_at',
  is_active:  'is_active',
});

export const ORDERABLE = new Set([
  COLS.name,
  COLS.created_at,
  COLS.updated_at,
  COLS.is_active,
]);

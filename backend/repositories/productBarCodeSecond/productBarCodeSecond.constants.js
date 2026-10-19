// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ productBarCodeSecond.constants.js — Tabela, colunas e ordenação         ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ──────────────────────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────────────────────
export const TB = '"productBarCodeSecond"';
export const DEFAULT_PRICE_ID = 2; // 🔹 ATCDO. (price_id = 2)

export const COLS = Object.freeze({
  id:              'id',
  product_code:    'product_code',
  product_unit_id: 'product_unit_id',
  second_bar_code: 'second_bar_code',
  code_type:       'code_type',
  price_id:        'price_id',     // 🔹 nova coluna
  created_at:      'created_at',
  updated_at:      'updated_at',
});

export const ORDERABLE = new Set([
  COLS.id,
  COLS.product_code,
  COLS.product_unit_id,
  COLS.second_bar_code,
  COLS.price_id,
  COLS.created_at,
  COLS.updated_at,
]);

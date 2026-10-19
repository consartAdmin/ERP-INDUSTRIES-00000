// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsUnits.constants.js — tabelas e colunas fixas de productsUnits ║
// ╚════════════════════════════════════════════════════════════════════╝

/* ──────────────────────────────────────────────────────────────────────────────
   Constantes
───────────────────────────────────────────────────────────────────────────── */
export const TB = '"productsUnits"';
export const UNITS_TB = 'units';
export const PBC_TB = '"productsBarCode"';

/** Colunas "fixas" da productsUnits (as de SKU variam) */
export const COLS = Object.freeze({
  id:          'product_unit_id',
  unit_id:     'unit_id',
  unit:        'unit',
  fator:       'fator',
  description: 'description',
  barcode:     'barcode',
  standard:    'standard',
  created_at:  'created_at',
  updated_at:  'updated_at',
  is_active:   'is_active',
});

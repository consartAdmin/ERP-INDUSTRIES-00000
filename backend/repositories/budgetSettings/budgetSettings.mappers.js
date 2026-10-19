// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetSettings.mappers.js — Linha do banco → objeto de parâmetros    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { SETTINGS_ID, DEFAULTS } from './budgetSettings.catalog.js';
import { normalizeMode } from './budgetSettings.sanitizers.js';

export function normalizeRow(row) {
  if (!row) return null;

  const mode = normalizeMode(row);

  return {
    ...row,
    setting_id: Number(row.setting_id || SETTINGS_ID),
    out_of_stock_mode: mode,
    allow_out_of_stock: mode !== 'BLOCK',
    require_stock_lot: row.require_stock_lot === true,
    allow_manual_unit_price: row.allow_manual_unit_price !== false,
    // numeric chega do driver pg como string.
    max_discount_percent: Number(row.max_discount_percent ?? DEFAULTS.max_discount_percent),
  };
}

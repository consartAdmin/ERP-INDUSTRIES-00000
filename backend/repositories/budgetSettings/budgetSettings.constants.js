// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetSettings.constants.js — Constantes derivadas do catálogo       ║
// ║ VALID_MODES / SELECT_COLUMNS                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { OUT_OF_STOCK_MODES, COLUMN_NAMES } from './budgetSettings.catalog.js';

export const VALID_MODES = new Set(OUT_OF_STOCK_MODES);
export const SELECT_COLUMNS = COLUMN_NAMES.join(',\n      ');

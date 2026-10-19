// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsShipping.constants.js — Constantes extraídas do catálogo      ║
// ║ TABLE / LOOKUP_KEY / COLUMNS / SELECT_COLUMNS / WRITE_COLUMNS / API  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import budgetsShippingSchema from './budgetsShipping.catalog.js';

export const {
  qualifiedName: TABLE,
  lookupKey: LOOKUP_KEY,
  columns: COLUMNS,
  selectColumns: SELECT_COLUMNS,
  writeColumns: WRITE_COLUMNS,
  api: API,
} = budgetsShippingSchema;

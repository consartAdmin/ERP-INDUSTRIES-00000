// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalV2.constants.js — colunas do RETURNING (catálogo)      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { PRODUCTS_FISCAL_V2_SELECT_COLUMNS } from './productsFiscalV2.catalog.js';

// ============================================================================
// CATÁLOGO — COLUNAS E VALIDAÇÃO
// ============================================================================

// Lista explícita no lugar de RETURNING *, definida pelo catálogo.
export const RETURNING = PRODUCTS_FISCAL_V2_SELECT_COLUMNS
  .map((column) => `"${column}"`)
  .join(', ');

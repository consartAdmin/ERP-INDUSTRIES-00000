// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusTypes.constants.js — Tabela, alias e colunas         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { erpTable } from '../../utils/erpCompanyContext.js';

export const TB = 'public."customerStatusTypes"';

// Tabela da empresa da request (BH3 ou a cópia da Consart ERP)
export const tbl = () => erpTable(TB);
export const ALIAS = 'cst';

// Campos válidos para insert/update
export const FIELDS = [
  'name_pt',
  'internal_code',
  'description_en',
  'color_hex',
  'sort_order',
  'is_active',
];

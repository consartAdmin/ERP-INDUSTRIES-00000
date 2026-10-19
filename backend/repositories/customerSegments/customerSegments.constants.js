// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerSegments.constants.js — Tabela, alias e SQL de timestamp   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { erpTable } from '../../utils/erpCompanyContext.js';

export const TB = 'public."customerSegments"';

// Tabela da empresa da request (BH3 ou a cópia da Consart ERP)
export const tbl = () => erpTable(TB);
export const ALIAS = 'cseg';
export const nowSql = 'NOW()';

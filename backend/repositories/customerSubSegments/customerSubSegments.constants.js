// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerSubSegments.constants.js — Tabela, alias e SQL timestamp   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { erpTable } from '../../utils/erpCompanyContext.js';

export const TB = 'public."customerSubSegments"';

// Tabela da empresa da request (BH3 ou a cópia da Consart ERP)
export const tbl = () => erpTable(TB);
export const ALIAS = 'csubseg';
export const nowSql = 'NOW()';

// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellers.constants.js — Tabela e alias de Vendedores                ║
// ╚════════════════════════════════════════════════════════════════════╝

import { erpTable } from '../../utils/erpCompanyContext.js';

export const TB    = 'public."sellers"';

// Tabela da empresa da request (BH3 ou a cópia da Consart ERP)
export const tbl = () => erpTable(TB);
export const ALIAS = 's';

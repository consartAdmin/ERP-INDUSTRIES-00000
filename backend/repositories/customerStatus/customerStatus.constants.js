// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatus.constants.js — Tabela, alias e colunas permitidas   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { erpTable } from '../../utils/erpCompanyContext.js';

export const TB = 'public."customerStatus"';

// Tabela da empresa da request (BH3 ou a cópia da Consart ERP)
export const tbl = () => erpTable(TB);
export const ALIAS = 'cs';

export const FIELDS = ['customer_id', 'status_type_id', 'note', 'updated_by'];

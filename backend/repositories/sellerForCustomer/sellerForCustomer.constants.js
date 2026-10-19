// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerForCustomer.constants.js — Tabela Vendedor ↔ Cliente         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { erpTable } from '../../utils/erpCompanyContext.js';

export const TB = 'public."SellerForCustomer"';

// Tabela da empresa da request (BH3 ou a cópia da Consart ERP)
export const tbl = () => erpTable(TB);

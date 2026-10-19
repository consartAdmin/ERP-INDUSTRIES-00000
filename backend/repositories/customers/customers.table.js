// ╔════════════════════════════════════════════════════════════════════╗
// ║ customers.table.js — Qual tabela de clientes a request usa         ║
// ║ BH3     → public."customers"        (padrão)                       ║
// ║ CONSART → public."customersConsart" (clientes da Consart ERP)      ║
// ║ A empresa vem do contexto da request (utils/erpCompanyContext.js). ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './customers.constants.js';
import { erpTable, runWithErpCompany, CONSART_TABLES } from '../../utils/erpCompanyContext.js';

export const TB_CONSART = CONSART_TABLES[TB];

/** Tabela de clientes da request atual. */
export function tb() {
  return erpTable(TB);
}

/** Roda fn() com a tabela da empresa informada. */
export function runWithCustomersTable(company, fn) {
  return runWithErpCompany(company, fn);
}

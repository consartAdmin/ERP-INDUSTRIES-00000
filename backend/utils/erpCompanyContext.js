// ╔════════════════════════════════════════════════════════════════════╗
// ║ erpCompanyContext.js — Empresa da request (BH3 x CONSART)          ║
// ║ O server.js roda cada request dentro do contexto da empresa da     ║
// ║ tela (X-ERP-Company ou ?company=). Os repositórios pedem a tabela  ║
// ║ com erpTable(TB): na CONSART volta a tabela própria da Consart.    ║
// ║ Fora de uma request (jobs, boot) vale sempre a BH3.                ║
// ╚════════════════════════════════════════════════════════════════════╝

import { AsyncLocalStorage } from 'node:async_hooks';
import { ERP_COMPANY_DEFAULT, normalizeErpCompany, getErpCompany } from './erpCompany.js';

// Tabela BH3 → tabela da Consart ERP
export const CONSART_TABLES = Object.freeze({
  'public."customers"': 'public."customersConsart"',
  'public."customerStatus"': 'public."customerStatusConsart"',
  'public."customerStatusTypes"': 'public."customerStatusTypesConsart"',
  'public."customerSegments"': 'public."customerSegmentsConsart"',
  'public."customerSubSegments"': 'public."customerSubSegmentsConsart"',
  'public."SellerForCustomer"': 'public."SellerForCustomerConsart"',
  'public."sellers"': 'public."sellersConsart"',
});

const store = new AsyncLocalStorage();

/** Empresa da request atual ('BH3' fora de request). */
export function currentErpCompany() {
  return store.getStore() || ERP_COMPANY_DEFAULT;
}

/** Roda fn() no contexto da empresa informada. */
export function runWithErpCompany(company, fn) {
  return store.run(normalizeErpCompany(company), fn);
}

/** Tabela que a request atual deve usar no lugar de `table` (nome BH3). */
// Aceita o nome com ou sem aspas (public.sellers = public."sellers")
const CONSART_BY_KEY = Object.fromEntries(
  Object.entries(CONSART_TABLES).map(([k, v]) => [k.replace(/"/g, ''), v])
);

export function erpTable(table) {
  if (currentErpCompany() === 'CONSART') return CONSART_BY_KEY[String(table).replace(/"/g, '')] || table;
  return table;
}

/** Middleware Express: contexto da empresa da tela. */
export function erpCompanyContext(req, res, next) {
  // A mesma URL responde diferente por empresa: caches não podem misturar
  res.vary('X-ERP-Company');
  runWithErpCompany(getErpCompany(req), next);
}

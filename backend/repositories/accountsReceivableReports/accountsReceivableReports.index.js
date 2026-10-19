// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableReports.index.js — ponto de entrada do módulo    ║
// ║ Mantém a mesma API pública do antigo accountsReceivableReportsApi  ║
// ║ (somente named exports; o original não tinha default)              ║
// ╚════════════════════════════════════════════════════════════════════╝

export { getSummary, listSales, listAllSales } from './accountsReceivableReportsQuery.repository.js';

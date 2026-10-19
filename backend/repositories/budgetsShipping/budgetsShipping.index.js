// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsShipping.index.js — Budgets Shipping API                      ║
// ║ Mantém a mesma API pública do antigo budgetsShippingApi.js           ║
// ║ CONSART ERP                                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

export { getByBudgetId, upsert, remove } from './budgetsShippingCrud.repository.js';

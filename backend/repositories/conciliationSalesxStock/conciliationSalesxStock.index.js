// ╔════════════════════════════════════════════════════════════════════╗
// ║ conciliationSalesxStock.index.js — ponto de entrada do módulo      ║
// ║ Mantém a API pública do antigo conciliationSalesxStockApi.js       ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  listSalesStockReconciliation,
  getSalesStockSummary,
} from './conciliationSalesxStockQuery.repository.js';

export { listSalesStockReconciliation, getSalesStockSummary };

export default {
  listSalesStockReconciliation,
  getSalesStockSummary,
};

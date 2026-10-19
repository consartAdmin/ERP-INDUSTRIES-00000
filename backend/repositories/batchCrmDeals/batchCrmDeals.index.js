// ╔════════════════════════════════════════════════════════════════════╗
// ║ batchCrmDeals.index.js — ponto de entrada do CRM Deals em lote     ║
// ║ Mantém a mesma API pública do antigo batchCrmDealsApi.js           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { searchCustomers } from './batchCrmDealsQuery.repository.js';
import { createBatchDeals } from './batchCrmDealsCreate.repository.js';

export { searchCustomers, createBatchDeals };

export default {
  searchCustomers,
  createBatchDeals,
};

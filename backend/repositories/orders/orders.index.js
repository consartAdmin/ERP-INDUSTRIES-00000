// ╔══════════════════════════════════════════════════════════════════════╗
// ║ orders.index.js — Pedidos                                            ║
// ║ Mantém a mesma API pública do antigo ordersApi.js                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ensureTables } from './ordersSchema.repository.js';
import { search, list, listPendingNfe } from './ordersQuery.repository.js';
import { getById } from './ordersGetById.repository.js';
import { createFromBudget } from './ordersCreate.repository.js';
import { returnToBudget } from './ordersReturnToBudget.repository.js';
import { update } from './ordersUpdate.repository.js';
import { remove } from './ordersRemove.repository.js';
import { getTotals } from './ordersTotals.repository.js';
import { getPaymentsByOrder, getNfePaymentPayload, resyncPaymentDueDatesFromNfeDate } from './ordersPayments.repository.js';

export {
  ensureTables,
  returnToBudget,
  search,
  list,
  getById,
  resyncPaymentDueDatesFromNfeDate,
  getPaymentsByOrder,
  getNfePaymentPayload,
  createFromBudget,
  update,
  remove,
  getTotals,
  listPendingNfe,
};

// ----------------------------------------------------------------------
// Export default
// ----------------------------------------------------------------------
const ordersApi = {
  ensureTables,
  search,
  list,
  getById,
  createFromBudget,
  returnToBudget,
  update,
  remove,
  getTotals,
  listPendingNfe,
  getPaymentsByOrder,
  getNfePaymentPayload,
  resyncPaymentDueDatesFromNfeDate,
};

export default ordersApi;

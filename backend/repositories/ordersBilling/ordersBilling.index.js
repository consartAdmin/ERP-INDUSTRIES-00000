// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersBilling.index.js — ponto de entrada do módulo ordersBilling  ║
// ║ Mantém a mesma API pública do antigo ordersBillingApi.js           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './ordersBillingSchema.repository.js';
import { createFromAsaasCharge } from './ordersBillingCreate.repository.js';
import { listByOrder, listByProviderId } from './ordersBillingQuery.repository.js';
import { updateStatusByProviderId } from './ordersBillingUpdate.repository.js';

export {
  ensureTable,
  createFromAsaasCharge,
  listByOrder,
  listByProviderId,
  updateStatusByProviderId,
};

export default {
  ensureTable,
  createFromAsaasCharge,
  listByOrder,
  listByProviderId,
  updateStatusByProviderId,
};

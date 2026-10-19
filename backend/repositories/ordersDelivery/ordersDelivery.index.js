// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersDelivery.index.js — ponto de entrada do módulo ordersDelivery║
// ║ Mantém a mesma API pública do antigo ordersDeliveryApi.js          ║
// ║ (somente default export — objeto com métodos)                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './ordersDeliverySchema.repository.js';
import { getByOrderId } from './ordersDeliveryGetById.repository.js';
import { upsertByOrderId } from './ordersDeliveryUpsert.repository.js';
import { removeByOrderId } from './ordersDeliveryRemove.repository.js';

export default {
  ensureTable,
  getByOrderId,
  upsertByOrderId,
  removeByOrderId,
};

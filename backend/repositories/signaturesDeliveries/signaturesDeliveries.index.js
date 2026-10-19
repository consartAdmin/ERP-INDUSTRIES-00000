// ╔════════════════════════════════════════════════════════════════════╗
// ║ signaturesDeliveries.index.js — ponto de entrada (Assinaturas)     ║
// ║ Mantém a mesma API pública do antigo signaturesDeliveriesApi.js    ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './signaturesDeliveriesSchema.repository.js';
import { list, search, getById } from './signaturesDeliveriesQuery.repository.js';
import { create } from './signaturesDeliveriesCreate.repository.js';
import { update } from './signaturesDeliveriesUpdate.repository.js';
import { remove } from './signaturesDeliveriesRemove.repository.js';

export { ensureTable, list, search, getById, create, update, remove };

export default {
  ensureTable,
  list,
  search,
  getById,
  create,
  update,
  remove,
};

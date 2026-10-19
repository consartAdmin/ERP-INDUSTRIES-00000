// ╔════════════════════════════════════════════════════════════════════╗
// ║ counterPanelCustomers.index.js — ponto de entrada (Counter Panel)  ║
// ║ Mantém a mesma API pública do antigo counterPanelCustomersApi.js   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTables } from './counterPanelCustomersSchema.repository.js';
import { search, list, getById } from './counterPanelCustomersQuery.repository.js';
import { create } from './counterPanelCustomersCreate.repository.js';
import { update, markViewed, markDownloaded } from './counterPanelCustomersUpdate.repository.js';
import { remove } from './counterPanelCustomersRemove.repository.js';

export { ensureTables, search, list, getById, create, update, remove, markViewed, markDownloaded };

// ----------------------------------------------------------------------
const counterPanelCustomersApi = {
  ensureTables,
  search,
  list,
  getById,
  create,
  update,
  remove,
  markViewed,
  markDownloaded, // ✅ novo
};

export default counterPanelCustomersApi;

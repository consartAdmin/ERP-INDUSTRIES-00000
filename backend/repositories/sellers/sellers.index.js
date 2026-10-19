// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellers.index.js — ponto de entrada do módulo Vendedores           ║
// ║ Mantém a mesma API pública do antigo sellersApi.js                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './sellersSchema.repository.js';
import { list, search, getById } from './sellersQuery.repository.js';
import { create } from './sellersCreate.repository.js';
import { update } from './sellersUpdate.repository.js';
import { remove } from './sellersRemove.repository.js';

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

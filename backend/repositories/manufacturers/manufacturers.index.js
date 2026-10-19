// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturers.index.js — ponto de entrada do módulo Fabricantes    ║
// ║ Mantém a mesma API pública do antigo manufacturersApi.js           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureManufacturersTable } from './manufacturersSchema.repository.js';
import { list, search, getById } from './manufacturersQuery.repository.js';
import { create } from './manufacturersCreate.repository.js';
import { update } from './manufacturersUpdate.repository.js';
import { remove } from './manufacturersRemove.repository.js';

export { ensureManufacturersTable, list, search, getById, create, update, remove };

export default {
  ensureManufacturersTable,
  list,
  search,
  getById,
  create,
  update,
  remove
};

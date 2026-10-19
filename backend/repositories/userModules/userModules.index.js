// ╔════════════════════════════════════════════════════════════════════╗
// ║ userModules.index.js — ponto de entrada permissões de módulos      ║
// ║ Mantém a mesma API pública do antigo userModulesApi.js             ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './userModulesSchema.repository.js';
import { list, getById, listModulesForUser } from './userModulesQuery.repository.js';
import { create } from './userModulesCreate.repository.js';
import { update } from './userModulesUpdate.repository.js';
import { remove } from './userModulesRemove.repository.js';

export { ensureTable, list, getById, create, update, remove, listModulesForUser };

export default {
  ensureTable,
  list,
  getById,
  create,
  update,
  remove,
  listModulesForUser,
};

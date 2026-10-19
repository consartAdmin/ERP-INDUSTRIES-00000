// ╔════════════════════════════════════════════════════════════════════╗
// ║ taskGroups.index.js — ponto de entrada do módulo taskGroups        ║
// ║ Mantém a mesma API pública do antigo taskGroupsApi.js              ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './taskGroups.constants.js';
import { ensureTable } from './taskGroupsSchema.repository.js';
import { list, getById } from './taskGroupsQuery.repository.js';
import { create } from './taskGroupsCreate.repository.js';
import { update } from './taskGroupsUpdate.repository.js';
import { remove, restore } from './taskGroupsRemove.repository.js';

export { TB, ensureTable, list, getById, create, update, remove, restore };

export default {
  ensureTable,
  list,
  getById,
  create,
  update,
  remove,
  restore,
};

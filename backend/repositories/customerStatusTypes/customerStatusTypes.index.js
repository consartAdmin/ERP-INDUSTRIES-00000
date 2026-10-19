// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusTypes.index.js — ponto de entrada do módulo          ║
// ║ Mantém a mesma API pública do antigo customerStatusTypesApi.js     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './customerStatusTypesSchema.repository.js';
import { create } from './customerStatusTypesCreate.repository.js';
import { updateById } from './customerStatusTypesUpdate.repository.js';
import { getById } from './customerStatusTypesGetById.repository.js';
import { removeById } from './customerStatusTypesRemove.repository.js';
import { list, search } from './customerStatusTypesQuery.repository.js';

export { ensureTable, create, updateById, getById, removeById, list, search };

export default {
  ensureTable,
  create,
  updateById,
  getById,
  removeById,
  list,
  search,
};

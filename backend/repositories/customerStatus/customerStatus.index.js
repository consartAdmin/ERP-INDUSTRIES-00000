// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatus.index.js — ponto de entrada do módulo status        ║
// ║ Mantém a mesma API pública do antigo customerStatusApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './customerStatusSchema.repository.js';
import { create, setStatusForCustomer } from './customerStatusCreate.repository.js';
import { updateById } from './customerStatusUpdate.repository.js';
import { getById, getByCustomerId } from './customerStatusGetById.repository.js';
import { removeByCustomerId } from './customerStatusRemove.repository.js';
import { list } from './customerStatusQuery.repository.js';

export {
  ensureTable,
  create,
  updateById,
  getById,
  getByCustomerId,
  setStatusForCustomer,
  removeByCustomerId,
  list,
};

export default {
  ensureTable,
  create,
  updateById,
  getById,
  getByCustomerId,
  setStatusForCustomer,
  removeByCustomerId,
  list,
};

// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByUser.index.js — ponto de entrada Usuário x Vendedor        ║
// ║ Mantém a mesma API pública do antigo sellerByUserApi.js            ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTables } from './sellerByUserSchema.repository.js';
import { list, getById, getByUserId } from './sellerByUserQuery.repository.js';
import { create } from './sellerByUserCreate.repository.js';
import { update, toggleActive, setPrimary } from './sellerByUserUpdate.repository.js';
import { remove } from './sellerByUserRemove.repository.js';

export {
  ensureTables,
  list,
  getById,
  getByUserId,
  create,
  update,
  remove,
  toggleActive,
  setPrimary,
};

export default {
  ensureTables,
  list,
  getById,
  getByUserId,
  create,
  update,
  remove,
  toggleActive,
  setPrimary,
};

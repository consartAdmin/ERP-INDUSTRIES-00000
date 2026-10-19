// ╔════════════════════════════════════════════════════════════════════╗
// ║ modulePasswords.index.js — ponto de entrada do módulo              ║
// ║ Senhas por módulo/ação (ex.: CUSTOMERS / EXPORT)                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable, ready } from './modulePasswordsSchema.repository.js';
import { list, getById } from './modulePasswordsQuery.repository.js';
import {
  create,
  updateById,
  clearPassword,
  removeById,
} from './modulePasswordsSave.repository.js';
import {
  isModulePasswordRequired,
  verifyModulePassword,
} from './modulePasswordsVerify.repository.js';

export {
  ensureTable,
  ready,
  list,
  getById,
  create,
  updateById,
  clearPassword,
  removeById,
  isModulePasswordRequired,
  verifyModulePassword,
};

export default {
  ensureTable,
  ready,
  list,
  getById,
  create,
  updateById,
  clearPassword,
  removeById,
  isModulePasswordRequired,
  verifyModulePassword,
};

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ pdv_logins.index.js — ponto de entrada do módulo                     ║
// ║ Mantém a mesma API pública do antigo pdv_loginsApi.js                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './pdv_loginsSchema.repository.js';
import { list, getById } from './pdv_loginsQuery.repository.js';
import { create } from './pdv_loginsCreate.repository.js';
import { update, setActive } from './pdv_loginsUpdate.repository.js';
import { remove } from './pdv_loginsRemove.repository.js';
import { verifyCredentials } from './pdv_loginsAuth.repository.js';

export {
  ensureTable,
  list,
  getById,
  create,
  update,
  setActive,
  remove,
  verifyCredentials,
};

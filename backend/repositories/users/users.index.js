// ╔════════════════════════════════════════════════════════════════════╗
// ║ users.index.js — ponto de entrada do módulo users (DAL)            ║
// ║ Mantém a mesma API pública do antigo usersApi.js                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './usersSchema.repository.js';
import { list, search, getById } from './usersQuery.repository.js';
import { create } from './usersCreate.repository.js';
import { update } from './usersUpdate.repository.js';
import { remove } from './usersRemove.repository.js';

export { ensureTable, list, search, getById, create, update, remove };

export default { ensureTable, list, search, getById, create, update, remove };

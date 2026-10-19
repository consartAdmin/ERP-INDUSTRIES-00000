// ╔════════════════════════════════════════════════════════════════════╗
// ║ processesUsers.index.js — ponto de entrada do módulo               ║
// ║ Mantém a mesma API pública do antigo processesUsersApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB, ALIAS } from './processesUsers.constants.js';
import { ensureTable } from './processesUsersSchema.repository.js';
import { list, getById } from './processesUsersQuery.repository.js';
import { create } from './processesUsersCreate.repository.js';
import { update } from './processesUsersUpdate.repository.js';
import { remove } from './processesUsersRemove.repository.js';

export { TB, ALIAS, ensureTable, list, getById, create, update, remove };

export default { ensureTable, list, getById, create, update, remove };

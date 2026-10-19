// ╔════════════════════════════════════════════════════════════════════╗
// ║ processes.index.js — ponto de entrada do módulo processes          ║
// ║ Mantém a mesma API pública do antigo processesApi.js               ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB, ALIAS } from './processes.constants.js';
import { ensureTable } from './processesSchema.repository.js';
import { list, getById } from './processesQuery.repository.js';
import { create } from './processesCreate.repository.js';
import { update } from './processesUpdate.repository.js';
import { remove } from './processesRemove.repository.js';

export { TB, ALIAS, ensureTable, list, getById, create, update, remove };

export default { ensureTable, list, getById, create, update, remove };

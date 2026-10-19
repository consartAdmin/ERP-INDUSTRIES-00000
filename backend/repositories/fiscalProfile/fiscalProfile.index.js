// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalProfile.index.js — ponto de entrada do módulo                ║
// ║ Mantém a API pública do antigo fiscalProfileApi.js                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './fiscalProfileSchema.repository.js';
import { list, getById } from './fiscalProfileQuery.repository.js';
import { create } from './fiscalProfileCreate.repository.js';
import { update } from './fiscalProfileUpdate.repository.js';
import { remove } from './fiscalProfileRemove.repository.js';

export { TB, ALIAS } from './fiscalProfile.constants.js';
export { ensureTable };

export default { ensureTable, list, getById, create, update, remove };

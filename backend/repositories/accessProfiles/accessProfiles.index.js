// ╔════════════════════════════════════════════════════════════════════╗
// ║ accessProfiles.index.js — ponto de entrada cadastro de perfis      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './accessProfilesSchema.repository.js';
import { list, getById, getCatalogMap } from './accessProfilesQuery.repository.js';
import { create } from './accessProfilesCreate.repository.js';
import { update } from './accessProfilesUpdate.repository.js';
import { remove } from './accessProfilesRemove.repository.js';

export { ensureTable, list, getById, getCatalogMap, create, update, remove };

export default { ensureTable, list, getById, getCatalogMap, create, update, remove };

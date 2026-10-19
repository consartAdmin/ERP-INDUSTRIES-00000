// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersIbge.index.js — ponto de entrada do módulo IBGE           ║
// ║ Mantém a mesma API pública do antigo customersIbgeApi.js           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable, ensureTables } from './customersIbgeSchema.repository.js';
import { search, list } from './customersIbgeQuery.repository.js';
import { getByCustomerId, getByUfCity } from './customersIbgeGetById.repository.js';
import { upsert } from './customersIbgeUpsert.repository.js';
import { update } from './customersIbgeUpdate.repository.js';
import { remove } from './customersIbgeRemove.repository.js';

export {
  ensureTable,
  ensureTables,
  search,
  list,
  getByCustomerId,
  getByUfCity,
  upsert,
  update,
  remove,
};

// ----------------------------------------------------------------------
// Export default
// ----------------------------------------------------------------------
const customersIbgeApi = {
  ensureTable,
  ensureTables, // alias compat
  search,
  list,
  getByCustomerId,
  getByUfCity,
  upsert,
  update,
  remove,
};

export default customersIbgeApi;

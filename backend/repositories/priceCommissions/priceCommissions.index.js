// ╔════════════════════════════════════════════════════════════════════╗
// ║ priceCommissions.index.js — ponto de entrada (comissões por tabela)║
// ║ Mantém a mesma API pública do antigo priceCommissionsApi.js        ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTables } from './priceCommissionsSchema.repository.js';
import { list, getById } from './priceCommissionsQuery.repository.js';
import { create } from './priceCommissionsCreate.repository.js';
import { update } from './priceCommissionsUpdate.repository.js';
import { remove } from './priceCommissionsRemove.repository.js';
import { listPrices, listSellers } from './priceCommissionsLookups.repository.js';

export { ensureTables, list, getById, create, update, remove, listPrices, listSellers };

const priceCommissionsApi = {
  ensureTables,
  list,
  getById,
  create,
  update,
  remove,
  listPrices,
  listSellers,
};

export default priceCommissionsApi;

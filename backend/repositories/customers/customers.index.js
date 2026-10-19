// ╔════════════════════════════════════════════════════════════════════╗
// ║ customers.index.js — ponto de entrada único do módulo customers    ║
// ║ Mantém a mesma API pública do antigo services/apis/customersApi.js ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './customersSchema.repository.js';
import { ensureCustomersConsartTable } from './customersConsart.schema.js';
import { ensureConsartCatalogTables } from './consartCatalogs.schema.js';
import { create } from './customersCreate.repository.js';
import { updateById } from './customersUpdate.repository.js';
import { getById } from './customersGetById.repository.js';
import { removeById } from './customersRemove.repository.js';
import { findByTaxId } from './customersFindByTaxId.repository.js';
import {
  list,
  search,
  listAllForExport,
} from './customersQuery.repository.js';
import {
  listWithoutAsaasId,
  saveAsaasId,
  countWithoutAsaasId,
} from './customersAsaas.repository.js';

// Tabela de clientes da Consart ERP (public."customersConsart").
// Depois dela, Status / Segmento / Vendedor próprios da Consart.
ensureCustomersConsartTable()
  .then(() => console.log('[customersApi] customersConsart OK'))
  .then(() => ensureConsartCatalogTables())
  .then(() => console.log('[customersApi] Status/Segmento/Vendedor Consart OK'))
  .catch((e) => console.warn('[customersApi] tabelas Consart falharam:', e?.message || e));

export {
  ensureTable,
  create,
  updateById,
  getById,
  removeById,
  findByTaxId,
  list,
  search,
  listAllForExport,
  listWithoutAsaasId,
  saveAsaasId,
  countWithoutAsaasId,
};

// Helpers reaproveitáveis por outros módulos
export { upsertCustomersIbge } from './customersIbge.repository.js';
export { saveDeliveryAddress } from './customersDeliveryAddress.repository.js';

export default {
  ensureTable,
  create,
  updateById,
  getById,
  removeById,
  findByTaxId,
  list,
  search,
  listAllForExport,
  listWithoutAsaasId,
  saveAsaasId,
  countWithoutAsaasId,
};

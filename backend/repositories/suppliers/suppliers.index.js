// ╔══════════════════════════════════════════════════════════════════════╗
// ║ suppliers.index.js — DAL / API de Fornecedores (CONSART ERP | ESM)   ║
// ║ Mantém a mesma API pública do antigo suppliersApi.js                 ║
// ║                                                                      ║
// ║ - Tabela alvo: public."suppliers"                                    ║
// ║ - Compatível com campo legado: address                               ║
// ║ - Novos campos: login, password, website, observations               ║
// ║ - Endereço organizado:                                               ║
// ║   address_street_type, address_street, address_number,               ║
// ║   address_complement,                                                ║
// ║   address_district, city, state, postal_code                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ensureSuppliersTable } from './suppliersSchema.repository.js';
import { list, search } from './suppliersQuery.repository.js';
import { getById } from './suppliersGetById.repository.js';
import { create } from './suppliersCreate.repository.js';
import { update } from './suppliersUpdate.repository.js';
import { remove } from './suppliersRemove.repository.js';

export {
  ensureSuppliersTable,
  list,
  search,
  getById,
  create,
  update,
  remove,
};

export default {
  ensureSuppliersTable,
  list,
  search,
  getById,
  create,
  update,
  remove,
};

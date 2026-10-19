// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterprise.index.js — ponto de entrada do módulo                     ║
// ║ Mantém a mesma API pública do antigo enterpriseApi.js (só default)   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { catalog_schema } from './enterprise.constants.js';
import { ensureTable } from './enterpriseSchema.repository.js';
import { list, count, findActive, findForPdf } from './enterpriseQuery.repository.js';
import { findById, findByCnpj } from './enterpriseGetById.repository.js';
import { create } from './enterpriseCreate.repository.js';
import { update, setActive } from './enterpriseUpdate.repository.js';
import { remove } from './enterpriseRemove.repository.js';

export default {
  schema: catalog_schema,
  ensureTable,
  list,
  count,
  findById,
  findByCnpj,
  findActive,
  findForPdf,
  create,
  update,
  remove,
  setActive
};

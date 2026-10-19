// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.index.js — ponto de entrada (Entradas de Despesa)   ║
// ║ Mantém a mesma API pública do antigo expenseEntriesApi.js          ║
// ║ (named: expenseEntriesApi, resolveSupplierId,                      ║
// ║  parseNfeXmlToExpenseEntryDraft; sem default)                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { parsePaging } from './expenseEntries.utils.js';
import { list, getById } from './expenseEntriesQuery.repository.js';
import { create } from './expenseEntriesCreate.repository.js';
import { update, cancel } from './expenseEntriesUpdate.repository.js';
import { remove } from './expenseEntriesRemove.repository.js';
import { post } from './expenseEntriesPost.repository.js';

export { resolveSupplierId } from './expenseEntriesSupplier.repository.js';
export { parseNfeXmlToExpenseEntryDraft } from './expenseEntriesXmlImport.repository.js';

// create/update/cancel usam this.getById — mantidos como métodos do objeto.
export const expenseEntriesApi = {
  parsePaging,
  list,
  getById,
  create,
  update,
  cancel,
  remove,
  post,
};

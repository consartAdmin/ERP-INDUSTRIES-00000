// ╔════════════════════════════════════════════════════════════════════╗
// ║ fixedExpenses.index.js — ponto de entrada (Despesas Fixas)         ║
// ║ Mantém a mesma API pública do antigo fixedExpensesApi.js           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './fixedExpensesSchema.repository.js';
import { list, count, getById } from './fixedExpensesQuery.repository.js';
import { create, upsertByCustomerAndReport } from './fixedExpensesCreate.repository.js';
import { update } from './fixedExpensesUpdate.repository.js';
import { remove } from './fixedExpensesRemove.repository.js';

export const fixedExpensesApi = {
  ensureTable,
  list,
  count,
  getById,
  create,
  update,
  remove,
  upsertByCustomerAndReport,
};

export default fixedExpensesApi;

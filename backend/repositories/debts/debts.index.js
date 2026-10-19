// ╔════════════════════════════════════════════════════════════════════╗
// ║ debts.index.js — ponto de entrada do módulo dívidas                ║
// ║ Mantém a mesma API pública do antigo debtsApi.js                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { list, getById, getSummary } from './debtsQuery.repository.js';
import { create } from './debtsCreate.repository.js';
import { update } from './debtsUpdate.repository.js';
import { remove } from './debtsRemove.repository.js';
import { createInstallments } from './debtsInstallments.repository.js';
import { recalcDebtById } from './debtsRecalc.repository.js';

export default {
  list,
  getById,
  create,
  update,
  remove,
  getSummary,
  createInstallments,
  recalcDebtById
};

// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGrades.index.js — ponto de entrada do módulo               ║
// ║ Mantém a mesma API pública do antigo productsGradesApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './productsGradesSchema.repository.js';
import { listByProduct, getBySku } from './productsGradesQuery.repository.js';
import { createUpsert } from './productsGradesUpsert.repository.js';
import { update } from './productsGradesUpdate.repository.js';
import { remove } from './productsGradesRemove.repository.js';

export { ensureTable, listByProduct, getBySku, createUpsert, update, remove };

export default {
  ensureTable,
  listByProduct,
  getBySku,
  createUpsert,
  update,
  remove,
};

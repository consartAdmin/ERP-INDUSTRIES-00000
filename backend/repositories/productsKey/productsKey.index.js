// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKey.index.js — ponto de entrada do módulo                  ║
// ║ Mantém a mesma API pública do antigo productsKeyApi.js             ║
// ╚════════════════════════════════════════════════════════════════════╝

import { normalizeKeyText } from './productsKey.sanitizers.js';
import { ensureTable } from './productsKeySchema.repository.js';
import { create, upsert } from './productsKeyCreate.repository.js';
import { getById, list, resolve } from './productsKeyQuery.repository.js';
import { remove } from './productsKeyRemove.repository.js';

export { normalizeKeyText, ensureTable, create, upsert, getById, remove, list, resolve };

export default {
  ensureTable,
  normalizeKeyText,
  create,
  upsert,
  getById,
  remove,
  list,
  resolve,
};

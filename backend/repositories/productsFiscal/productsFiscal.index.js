// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsFiscal.index.js — ponto de entrada do módulo               ║
// ║ Mantém a API pública do antigo productsFiscalApi.js                ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './productsFiscalSchema.repository.js';
import {
  list,
  getById,
  getCurrentBySku,
  getCurrentByProduct,
} from './productsFiscalQuery.repository.js';
import { createFromImport, closeCurrent } from './productsFiscalSnapshot.repository.js';
import { update } from './productsFiscalUpdate.repository.js';
import { softDelete } from './productsFiscalRemove.repository.js';
import { previewMerge, importFromRefs } from './productsFiscalImport.repository.js';

export {
  ensureTable,
  list,
  getById,
  getCurrentBySku,
  getCurrentByProduct,
  createFromImport,
  closeCurrent,
  update,
  softDelete,
  previewMerge,
  importFromRefs,
};

export default {
  ensureTable,
  list,
  getById,
  getCurrentByProduct, // compat (id ou SKU)
  getCurrentBySku,
  createFromImport,
  closeCurrent,
  update,
  softDelete,
  previewMerge,
  importFromRefs
};

// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsNotes.index.js — ponto de entrada do módulo                ║
// ║ Mantém a mesma API pública do antigo productsNotesApi.js           ║
// ║ (somente export default)                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { listByProduct, getById } from './productsNotesQuery.repository.js';
import { create } from './productsNotesCreate.repository.js';
import { update, softDelete } from './productsNotesUpdate.repository.js';

export default {
  listByProduct,
  getById,
  create,
  update,
  softDelete,
};

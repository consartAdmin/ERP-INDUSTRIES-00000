// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashMoviments.index.js — ponto de entrada do módulo Caixa          ║
// ║ Mantém a mesma API pública do antigo cashMovimentsApi.js           ║
// ║ Obs.: importar este módulo instancia o client do GCS (Storage)     ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  listMovements,
  listForPdf,
  getMovementById,
  summary,
} from './cashMovimentsQuery.repository.js';
import { createMovement } from './cashMovimentsCreate.repository.js';
import { updateMovement } from './cashMovimentsUpdate.repository.js';
import { deleteMovement } from './cashMovimentsRemove.repository.js';
import {
  listCategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  setCategoriaActive,
} from './cashMovimentsCategories.repository.js';
import {
  listSubcategorias,
  createSubcategoria,
  updateSubcategoria,
  deleteSubcategoria,
  listSubcategoriasByCategoria,
  setSubcategoriaActive,
} from './cashMovimentsSubcategories.repository.js';
import {
  listAnexos,
  addAnexo,
  deleteAnexo,
  copyAttachmentsFromAccountsPayable,
} from './cashMovimentsAttachments.repository.js';
import { ping, listChartAccountsForCaixa } from './cashMovimentsMisc.repository.js';
import { updateMovementsBatch, deleteMovementsBatch } from './cashMovimentsBatch.repository.js';

export {
  listMovements,
  listForPdf,
  getMovementById,
  createMovement,
  updateMovement,
  deleteMovement,
  summary,
  listCategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  listSubcategorias,
  createSubcategoria,
  updateSubcategoria,
  deleteSubcategoria,
  listSubcategoriasByCategoria,
  setCategoriaActive,
  setSubcategoriaActive,
  listAnexos,
  addAnexo,
  deleteAnexo,
  copyAttachmentsFromAccountsPayable,
  ping,
  listChartAccountsForCaixa,
  updateMovementsBatch,
  deleteMovementsBatch,
};

export default {
  copyAttachmentsFromAccountsPayable,

  listMovements,
  getMovementById,
  createMovement,
  updateMovement,
  deleteMovement,

  listForPdf,

  summary,

  listCategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria,

  listSubcategorias,
  createSubcategoria,
  updateSubcategoria,
  deleteSubcategoria,

  listSubcategoriasByCategoria,
  setCategoriaActive,
  setSubcategoriaActive,

  listChartAccountsForCaixa,

  listAnexos,
  addAnexo,
  deleteAnexo,
  deleteMovementsBatch,
  updateMovementsBatch,

  ping,
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ index.js — CONSART ERP | Notas de Entrada                               ║
// ║ Agrega repositories + services do módulo                                ║
// ║ PRODUCT_STOCK_MODE é aplicado na camada service; repositories ficam DAL ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { ensureColumnsForPosting } from './ensureColumnsForPosting.repository.js';
import { findProductByLmRef } from './findProductByLmRef.repository.js';

import { listInvoices } from './listInvoices.repository.js';
import { getInvoiceById } from './getInvoiceById.repository.js';
import { getInvoiceByAccessKey } from './getInvoiceByAccessKey.repository.js';
import { createInvoice } from './createInvoice.repository.js';
import { updateInvoice } from './updateInvoice.repository.js';
import { deleteInvoice } from './deleteInvoice.repository.js';
import { upsertInvoiceByAccessKey } from './upsertInvoiceByAccessKey.repository.js';
import { lockInvoiceForPost } from './lockInvoiceForPost.repository.js';
import { markInvoicePosted } from './markInvoicePosted.repository.js';

import { listItemsByInvoice } from './listItemsByInvoice.repository.js';
import { createItem as createItemRepository } from './createItem.repository.js';
import { updateItem as updateItemRepository } from './updateItem.repository.js';
import { deleteItem } from './deleteItem.repository.js';

import { listInstallmentsByInvoice } from './listInstallmentsByInvoice.repository.js';
import { createInstallment } from './createInstallment.repository.js';
import { updateInstallment } from './updateInstallment.repository.js';
import { deleteInstallment } from './deleteInstallment.repository.js';

import { registerInboundProductMovements } from './registerInboundProductMovements.repository.js';
import {
  markInvoicePostedWithMovements as markInvoicePostedWithMovementsRepository,
} from './markInvoicePostedWithMovements.repository.js';
import { clearInvoiceItemLots } from './clearInvoiceItemLots.repository.js';
import {
  ensureInboundItemLot,
  ensureInboundItemLots,
} from './ensureInboundItemLots.repository.js';

import { createItemWithStockMode } from './createItemWithStockMode.service.js';
import { updateItemWithStockMode } from './updateItemWithStockMode.service.js';
import { markInvoicePostedWithStockMode } from './markInvoicePostedWithStockMode.service.js';
import {
  INBOUND_STOCK_FEATURE_CODE,
  INBOUND_STOCK_MODES,
  getInboundFeatureScope,
  resolveInboundStockMode,
  normalizeInboundItemByStockMode,
  normalizeInboundItemsByStockMode,
  validateInboundItemForPosting,
  assertInboundItemsForPosting,
} from './inboundStockMode.service.js';

// ========================================================================== 
// Repositories sem regra de feature
// ========================================================================== 
export { ensureColumnsForPosting } from './ensureColumnsForPosting.repository.js';
export { findProductByLmRef } from './findProductByLmRef.repository.js';

export { listInvoices } from './listInvoices.repository.js';
export { getInvoiceById } from './getInvoiceById.repository.js';
export { getInvoiceByAccessKey } from './getInvoiceByAccessKey.repository.js';
export { createInvoice } from './createInvoice.repository.js';
export { updateInvoice } from './updateInvoice.repository.js';
export { deleteInvoice } from './deleteInvoice.repository.js';
export { upsertInvoiceByAccessKey } from './upsertInvoiceByAccessKey.repository.js';
export { lockInvoiceForPost } from './lockInvoiceForPost.repository.js';
export { markInvoicePosted } from './markInvoicePosted.repository.js';

export { listItemsByInvoice } from './listItemsByInvoice.repository.js';
export { deleteItem } from './deleteItem.repository.js';
export { clearInvoiceItemLots } from './clearInvoiceItemLots.repository.js';
export {
  ensureInboundItemLot,
  ensureInboundItemLots,
} from './ensureInboundItemLots.repository.js';

export { listInstallmentsByInvoice } from './listInstallmentsByInvoice.repository.js';
export { createInstallment } from './createInstallment.repository.js';
export { updateInstallment } from './updateInstallment.repository.js';
export { deleteInstallment } from './deleteInstallment.repository.js';

export { registerInboundProductMovements } from './registerInboundProductMovements.repository.js';

// Acesso explícito ao DAL bruto para usos internos/migrações.
export { createItemRepository, updateItemRepository, markInvoicePostedWithMovementsRepository };

// ========================================================================== 
// Services conscientes de PRODUCT_STOCK_MODE
//
// Compatibilidade: os nomes públicos createItem/updateItem e
// markInvoicePostedWithMovements continuam existindo, mas passam pela camada
// service. Assim callers que importam este index recebem a regra nova sem
// mover a lógica para dentro dos repositories.
// ========================================================================== 
export const createItem = createItemWithStockMode;
export const updateItem = updateItemWithStockMode;
export const markInvoicePostedWithMovements = markInvoicePostedWithStockMode;

export {
  createItemWithStockMode,
  updateItemWithStockMode,
  markInvoicePostedWithStockMode,
  INBOUND_STOCK_FEATURE_CODE,
  INBOUND_STOCK_MODES,
  getInboundFeatureScope,
  resolveInboundStockMode,
  normalizeInboundItemByStockMode,
  normalizeInboundItemsByStockMode,
  validateInboundItemForPosting,
  assertInboundItemsForPosting,
};

export default {
  ensureColumnsForPosting,
  findProductByLmRef,

  listInvoices,
  getInvoiceById,
  getInvoiceByAccessKey,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  upsertInvoiceByAccessKey,

  listInstallmentsByInvoice,
  createInstallment,
  updateInstallment,
  deleteInstallment,

  listItemsByInvoice,
  createItem: createItemWithStockMode,
  updateItem: updateItemWithStockMode,
  deleteItem,

  // DAL bruto, quando realmente necessário.
  createItemRepository,
  updateItemRepository,

  lockInvoiceForPost,
  markInvoicePosted,

  registerInboundProductMovements,
  markInvoicePostedWithMovements: markInvoicePostedWithStockMode,
  markInvoicePostedWithMovementsRepository,
  clearInvoiceItemLots,
  ensureInboundItemLot,
  ensureInboundItemLots,

  INBOUND_STOCK_FEATURE_CODE,
  INBOUND_STOCK_MODES,
  getInboundFeatureScope,
  resolveInboundStockMode,
  normalizeInboundItemByStockMode,
  normalizeInboundItemsByStockMode,
  validateInboundItemForPosting,
  assertInboundItemsForPosting,
};

// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrderItems.index.js — ponto de entrada (itens e-commerce) ║
// ║ Mantém a mesma API pública do antigo ecommerceOrderItemsApi.js     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './ecommerceOrderItemsSchema.repository.js';
import { listItems, getItemsByOrderId } from './ecommerceOrderItemsQuery.repository.js';
import { createItem, bulkInsert } from './ecommerceOrderItemsCreate.repository.js';
import { deleteItemsByOrder } from './ecommerceOrderItemsRemove.repository.js';

export {
  ensureTable,
  listItems,
  getItemsByOrderId,
  createItem,
  bulkInsert,
  deleteItemsByOrder,
};

export default {
  ensureTable,
  listItems,
  getItemsByOrderId,
  createItem,
  bulkInsert,
  deleteItemsByOrder,
};

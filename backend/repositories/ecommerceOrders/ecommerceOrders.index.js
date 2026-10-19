// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrders.index.js — ponto de entrada (pedidos e-commerce)   ║
// ║ Mantém a mesma API pública do antigo ecommerceOrdersApi.js         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './ecommerceOrdersSchema.repository.js';
import { listOrders, searchOrders } from './ecommerceOrdersQuery.repository.js';
import { getOrderById } from './ecommerceOrdersGetById.repository.js';
import { createOrder } from './ecommerceOrdersCreate.repository.js';
import { updateOrder } from './ecommerceOrdersUpdate.repository.js';
import { deleteOrder } from './ecommerceOrdersRemove.repository.js';

export {
  ensureTable,
  listOrders,
  searchOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
};

export default {
  ensureTable,
  listOrders,
  searchOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
};

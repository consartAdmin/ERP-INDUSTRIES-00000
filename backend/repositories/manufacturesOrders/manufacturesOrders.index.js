// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturesOrders.index.js — ponto de entrada (pedidos fabricante)║
// ║ Mantém a mesma API pública do antigo manufacturesOrdersApi.js      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { list, getById, listWithItems } from './manufacturesOrdersQuery.repository.js';
import { create, addItem } from './manufacturesOrdersCreate.repository.js';
import { update, updateItem } from './manufacturesOrdersUpdate.repository.js';
import { removeItem, remove } from './manufacturesOrdersRemove.repository.js';

export { list, listWithItems, getById, create, update, addItem, updateItem, removeItem, remove };

export default {
  list,
  listWithItems,
  getById,
  create,
  update,
  addItem,
  updateItem,
  removeItem,
  remove,
};

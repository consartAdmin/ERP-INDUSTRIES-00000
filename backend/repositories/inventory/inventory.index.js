// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventory.index.js — ponto de entrada do módulo inventário         ║
// ║ Mantém a API pública do antigo inventoryApi.js                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { list, getById } from './inventoryQuery.repository.js';
import { create } from './inventoryCreate.repository.js';
import { update } from './inventoryUpdate.repository.js';
import { remove } from './inventoryRemove.repository.js';
import { listItems, getItemById } from './inventoryItemsQuery.repository.js';
import { addItem } from './inventoryItemsAdd.repository.js';
import { removeItemFromInventory } from './inventoryItemsRemove.repository.js';
import { finalizeInventory } from './inventoryFinalize.repository.js';
import { listLogs } from './inventoryAudit.repository.js';
import { reopenInventory } from './inventoryReopen.repository.js';
import {
  resolveProductByBarcode,
  resolveInventoryPayloadFromBarcode,
} from './inventoryBarcode.repository.js';

export {
  list,
  getById,
  create,
  update,
  remove,
  listItems,
  getItemById,
  addItem,
  removeItemFromInventory,
  finalizeInventory,
  listLogs,
  reopenInventory,
  resolveProductByBarcode,
  resolveInventoryPayloadFromBarcode,
};

export default {
  list,
  getById,
  create,
  update,
  remove,
  listItems,
  getItemById,
  addItem,
  finalizeInventory,
  listLogs,
  removeItemFromInventory,
  reopenInventory,
  resolveProductByBarcode,
  resolveInventoryPayloadFromBarcode,
};

// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersLogistics.index.js — ponto de entrada (Logística de Pedidos) ║
// ║ Mantém a mesma API pública do antigo ordersLogisticsApi.js         ║
// ║ Fluxo: picking → conferência cega → embalagem → envio              ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTables } from './ordersLogisticsSchema.repository.js';
import {
  getLogisticsById,
  getLogisticsByOrderId,
  createLogisticsForOrder,
  getOrCreateLogisticsForOrder,
  updateLogisticsStatus,
  listLogisticsByStatus,
  listAllLogistics,
} from './ordersLogisticsHeader.repository.js';
import {
  listItemsByLogisticsId,
  getItem,
  createItem,
  getOrCreateItem,
  incrementPickedQty,
  incrementCheckedQty,
  updateItem,
  getItemById,
} from './ordersLogisticsItems.repository.js';
import {
  markBlindCheckStarted,
  finalizeBlindCheck,
} from './ordersLogisticsBlindCheck.repository.js';

export {
  ensureTables,
  getLogisticsById,
  getLogisticsByOrderId,
  createLogisticsForOrder,
  getOrCreateLogisticsForOrder,
  updateLogisticsStatus,
  listLogisticsByStatus,
  listAllLogistics,
  listItemsByLogisticsId,
  getItem,
  createItem,
  getOrCreateItem,
  incrementPickedQty,
  incrementCheckedQty,
  updateItem,
  getItemById,
  markBlindCheckStarted,
  finalizeBlindCheck,
};

// ---------------------------------------------------------------------
// Export default — bundle estilo service
// ---------------------------------------------------------------------
const ordersLogisticsApi = {
  ensureTables,

  // header
  getLogisticsById,
  getLogisticsByOrderId,
  createLogisticsForOrder,
  getOrCreateLogisticsForOrder,
  updateLogisticsStatus,
  listLogisticsByStatus,
  listAllLogistics,

  // items
  listItemsByLogisticsId,
  getItem,
  createItem,
  getOrCreateItem,
  incrementPickedQty,
  incrementCheckedQty,
  updateItem,
  getItemById,

  // blind check helpers
  markBlindCheckStarted,
  finalizeBlindCheck
};

export default ordersLogisticsApi;

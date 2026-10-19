// ╔════════════════════════════════════════════════════════════════════╗
// ║ OrdersLogisticsPacking.index.js — Router Express do packing        ║
// ║ Mantém a mesma API pública do antigo OrdersLogisticsPackingApi.js  ║
// ║ (default export = router; base sugerida: /api/packing)             ║
// ╚════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  getOrderSummary,
  listNotPacked,
  listOrderVolumes,
  createOrderVolume,
} from './OrdersLogisticsPackingOrders.repository.js';
import {
  updateVolume,
  deleteVolume,
  listVolumeItems,
  addVolumeItem,
} from './OrdersLogisticsPackingVolumes.repository.js';
import {
  updateVolumeItem,
  deleteVolumeItem,
  moveVolumeItem,
} from './OrdersLogisticsPackingVolumeItems.repository.js';

const router = Router();

router.get('/orders/:orderId/summary', getOrderSummary);
router.get('/orders/:orderId/not-packed', listNotPacked);
router.get('/orders/:orderId/volumes', listOrderVolumes);
router.post('/orders/:orderId/volumes', createOrderVolume);
router.patch('/volumes/:volumeId', updateVolume);
router.delete('/volumes/:volumeId', deleteVolume);
router.get('/volumes/:volumeId/items', listVolumeItems);
router.post('/volumes/:volumeId/items', addVolumeItem);
router.patch('/volume-items/:volumeItemId', updateVolumeItem);
router.delete('/volume-items/:volumeItemId', deleteVolumeItem);
router.post('/volume-items/:volumeItemId/move', moveVolumeItem);

export default router;

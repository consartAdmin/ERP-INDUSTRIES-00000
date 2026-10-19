// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ OrdersLogisticsPackingRoutes.js — Routes Packing/Volumes                ║
// ║ Path: backend/routes/OrdersLogisticsPackingRoutes.js                    ║
// ║ CONSART ERP | ESM | Express                                             ║
// ║                                                                          ║
// ║ Base sugerida no server.js:                                              ║
// ║   import packingRoutes from './routes/OrdersLogisticsPackingRoutes.js'   ║
// ║   app.use('/api/packing', packingRoutes);                                ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import {
  // Summary / Lists
  getOrderSummary,
  getNotPacked,
  listVolumes,
  listVolumeItems,

  // Volumes CRUD
  createVolume,
  updateVolume,
  deleteVolume,

  // Volume Items CRUD
  addItemToVolume,
  updateVolumeItem,
  deleteVolumeItem,
  moveVolumeItem,

  // Search (Modal)
  searchOrders,

  // PDF
  getOrderPackingPdf,
} from '../controllers/OrdersLogisticsPackingController.js';

const router = Router();

/* ──────────────────────────────────────────────────────────────
   🔎 Orders Search (Modal)
   GET /api/packing/orders/search?q=...&limit=...
────────────────────────────────────────────────────────────── */
router.get('/orders/search', searchOrders);

/* ──────────────────────────────────────────────────────────────
   📦 Order Summary (tudo que a tela precisa)
   GET /api/packing/orders/:orderId/summary
────────────────────────────────────────────────────────────── */
router.get('/orders/:orderId/summary', getOrderSummary);

/* ──────────────────────────────────────────────────────────────
   🧾 PDF do Packing
   GET /api/packing/orders/:orderId/pdf
────────────────────────────────────────────────────────────── */
router.get('/orders/:orderId/pdf', getOrderPackingPdf);

/* ──────────────────────────────────────────────────────────────
   🧩 Itens não alocados (fallback, se precisar chamar separado)
   GET /api/packing/orders/:orderId/not-packed
────────────────────────────────────────────────────────────── */
router.get('/orders/:orderId/not-packed', getNotPacked);

/* ──────────────────────────────────────────────────────────────
   📦 Volumes do pedido
   GET  /api/packing/orders/:orderId/volumes
   POST /api/packing/orders/:orderId/volumes
────────────────────────────────────────────────────────────── */
router.get('/orders/:orderId/volumes', listVolumes);
router.post('/orders/:orderId/volumes', createVolume);

/* ──────────────────────────────────────────────────────────────
   ✏️ Atualiza / remove volume
   PATCH  /api/packing/volumes/:volumeId
   DELETE /api/packing/volumes/:volumeId
────────────────────────────────────────────────────────────── */
router.patch('/volumes/:volumeId', updateVolume);
router.delete('/volumes/:volumeId', deleteVolume);

/* ──────────────────────────────────────────────────────────────
   📦 Itens do volume
   GET  /api/packing/volumes/:volumeId/items
   POST /api/packing/volumes/:volumeId/items
────────────────────────────────────────────────────────────── */
router.get('/volumes/:volumeId/items', listVolumeItems);
router.post('/volumes/:volumeId/items', addItemToVolume);

/* ──────────────────────────────────────────────────────────────
   ✏️ Atualiza / remove item no volume
   PATCH  /api/packing/volume-items/:volumeItemId
   DELETE /api/packing/volume-items/:volumeItemId
────────────────────────────────────────────────────────────── */
router.patch('/volume-items/:volumeItemId', updateVolumeItem);
router.delete('/volume-items/:volumeItemId', deleteVolumeItem);

/* ──────────────────────────────────────────────────────────────
   🔁 Move item entre volumes
   PATCH /api/packing/volume-items/:volumeItemId/move
────────────────────────────────────────────────────────────── */
router.patch('/volume-items/:volumeItemId/move', moveVolumeItem);

export default router;

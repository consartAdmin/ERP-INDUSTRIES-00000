// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: routes/orderDeliveryRoutes.js                                 ║
// ║ MODULE: Order Delivery Routes                                       ║
// ║ CONSART ERP                                                         ║
// ║ Base URL: /api/order-delivery                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';

import {
  ensureTable,
  getByOrderId,
  upsertByOrderId,
  removeByOrderId,
} from '../controllers/ordersDeliveryController.js';

const router = express.Router();

/* ====================================================================== */
/* Bootstrap                                                              */
/* ====================================================================== */

router.get('/ensure-table', ensureTable);

/* ====================================================================== */
/* Order Delivery (1:1)                                                   */
/* ====================================================================== */

// Buscar dados de frete do pedido
router.get('/order/:orderId', getByOrderId);

// Criar / Atualizar (UPSERT)
router.put('/order/:orderId', upsertByOrderId);

// Excluir informações de frete
router.delete('/order/:orderId', removeByOrderId);

export default router;
// ╔══════════════════════════════════════════════════════════════════════╗
// ║ sellerByOrdersRoutes.js — Rotas Vendedor x Pedido | CONSART ERP      ║
// ║ Base: /api/orders/:orderId/sellers                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';
import {
  listOrderSellers,
  upsertOrderSeller,
  patchOrderSeller,
  deleteOrderSeller,
} from '../controllers/sellerByOrdersController.js';

const router = express.Router({ mergeParams: true });

router.get('/', listOrderSellers);
router.post('/', upsertOrderSeller); // upsert (cria/atualiza)
router.put('/:sellerId', patchOrderSeller);
router.delete('/:sellerId', deleteOrderSeller);

export default router;

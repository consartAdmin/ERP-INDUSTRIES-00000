// ╔══════════════════════════════════════════════════════════════════════╗
// ║ deliveryRouteStopsRoutes.js — Rotas Express                         ║
// ║ CONSART ERP | ESM                                                   ║
// ║ Base sugerida: /api/deliveryRouteStops                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import {
  listByRoute,
  getById,
  create,
  update,
  remove,
  setStatus,
  reorder,
} from '../controllers/deliveryRouteStopsController.js';

const router = Router();

router.get('/route/:route_id', listByRoute);
router.get('/:stop_id', getById);

router.post('/', create);
router.put('/:stop_id', update);
router.delete('/:stop_id', remove);

router.patch('/:stop_id/status', setStatus);
router.patch('/reorder/items', reorder);

export default router;
// ╔══════════════════════════════════════════════════════════════════════╗
// ║ deliveryRoutesRoutes.js — Rotas Express (Rotas de Entrega)           ║
// ║ CONSART ERP | ESM                                                   ║
// ║ Base sugerida: /api/delivery-routes                                 ║
// ║ Endpoints:                                                          ║
// ║   GET    /               -> list   (q, is_active, route_type)        ║
// ║   GET    /:route_id      -> getById                                  ║
// ║   POST   /               -> create                                   ║
// ║   PUT    /:route_id      -> update                                   ║
// ║   DELETE /:route_id      -> remove                                   ║
// ║   PATCH  /:route_id/active -> setActive                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import {
  list,
  getById,
  create,
  update,
  remove,
  setActive,
} from '../controllers/deliveryRoutesController.js';

const router = Router();

router.get('/', list);
router.get('/:route_id', getById);

router.post('/', create);
router.put('/:route_id', update);

router.patch('/:route_id/active', setActive);

router.delete('/:route_id', remove);

export default router;
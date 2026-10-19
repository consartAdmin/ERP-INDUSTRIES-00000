// ╔════════════════════════════════════════════════════════════╗
// ║ paymentMethodsRoutes.js — Express Router (ESM)             ║
// ╚════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as ctrl from '../controllers/paymentMethodsController.js';

const router = Router();

// Base: /api/paymentMethods
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/active', ctrl.toggleActive);
router.delete('/:id', ctrl.remove);

export default router;
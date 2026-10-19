// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: routes/budgetsShippingRoutes.js                                ║
// ║ MODULE: Budgets Shipping Routes                                      ║
// ║ CONSART ERP                                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import * as Controller from '../controllers/budgetsShippingController.js';

const router = express.Router();

/*
 * Autenticação em todas as rotas. Seguro porque o router é montado com
 * prefixo ('/api/budgets-shipping'). Antes de 16/09/2026 nenhuma das 4
 * rotas exigia token, incluindo o DELETE.
 */
router.use(requireAuth);

router.get('/:budgetId', Controller.getByBudgetId);
router.post('/:budgetId', Controller.upsert);
router.put('/:budgetId', Controller.upsert);
router.delete('/:budgetId', Controller.remove);

export default router;
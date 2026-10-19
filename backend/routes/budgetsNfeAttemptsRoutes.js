/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║ budgetsNfeAttemptsRoutes.js — REST routes                           ║
 * ║ Base: /api/budgets-nfe-attempts                                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  listBudgetNfeAttempts,
  listBudgetNfeAttemptsByBudget,
  getBudgetNfeAttempt,
  createBudgetNfeAttempt,
  updateBudgetNfeAttempt,
  updateBudgetNfeAttemptStatus,
  linkBudgetNfeAttemptInvoice,
  deleteBudgetNfeAttempt,
} from '../controllers/budgetsNfeAttemptsController.js';

const router = Router();

/*
 * Autenticação em todas as rotas. Seguro porque o router é montado com
 * prefixo ('/api/budgets-nfe-attempts'). Estas são rotas de MANUTENÇÃO das
 * tentativas de NF-e — incluem PATCH de status e DELETE — e até 16/09/2026
 * nenhuma exigia token. Nenhum frontend as consome.
 */
router.use(requireAuth);

router.get('/', listBudgetNfeAttempts);
router.get('/budget/:budgetId', listBudgetNfeAttemptsByBudget);
router.get('/:attemptId', getBudgetNfeAttempt);
router.post('/', createBudgetNfeAttempt);
router.patch('/:attemptId', updateBudgetNfeAttempt);
router.patch('/:attemptId/status', updateBudgetNfeAttemptStatus);
router.patch('/:attemptId/link-invoice', linkBudgetNfeAttemptInvoice);
router.delete('/:attemptId', deleteBudgetNfeAttempt);

export default router;

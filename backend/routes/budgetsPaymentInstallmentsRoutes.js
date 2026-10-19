/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: budgetsPaymentInstallmentsRoutes.js                           ║
   ║ MODULE: Budget Payment Installments                                 ║
   ║ DESCRIPTION: Rotas HTTP para parcelas de pagamentos                 ║
   ║ CONSART ERP · Express · ESM                                         ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getBudgetPaymentInstallmentById,
  listBudgetPaymentInstallmentsByBudget,
  listBudgetPaymentInstallmentsByBudgetPayment,
  createBudgetPaymentInstallment,
  updateBudgetPaymentInstallment,
  deleteBudgetPaymentInstallment,
  deleteBudgetPaymentInstallmentsByBudgetPayment,
  generateInstallmentsFromBudgetPayment,
  generateInstallmentsFromBudget
} from '../controllers/budgetsPaymentInstallmentsController.js';

const router = Router();

/*
 * Autenticação em todas as rotas. Seguro porque o router é montado com
 * prefixo ('/api/budgets-payment-installments'). Antes de 16/09/2026
 * nenhuma das 9 rotas exigia token.
 */
router.use(requireAuth);

/* ─────────────────────────────────────────────────────────────
 * LISTAGENS
 * ───────────────────────────────────────────────────────────── */
router.get('/budget/:budgetId', listBudgetPaymentInstallmentsByBudget);
router.get('/budget-payment/:budgetPaymentId', listBudgetPaymentInstallmentsByBudgetPayment);
router.get('/:id', getBudgetPaymentInstallmentById);

/* ─────────────────────────────────────────────────────────────
 * CRUD MANUAL
 * ───────────────────────────────────────────────────────────── */
router.post('/', createBudgetPaymentInstallment);
router.put('/:id', updateBudgetPaymentInstallment);
router.delete('/:id', deleteBudgetPaymentInstallment);
router.delete('/budget-payment/:budgetPaymentId/all', deleteBudgetPaymentInstallmentsByBudgetPayment);

/* ─────────────────────────────────────────────────────────────
 * GERAÇÃO AUTOMÁTICA
 * ───────────────────────────────────────────────────────────── */
router.post('/generate/budget-payment/:budgetPaymentId', generateInstallmentsFromBudgetPayment);
router.post('/generate/budget/:budgetId', generateInstallmentsFromBudget);

export default router;
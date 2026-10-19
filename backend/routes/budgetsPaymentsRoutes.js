/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: budgetsPaymentsRoutes.js                                      ║
   ║ MODULE: Budgets Payments                                            ║
   ║ DESCRIPTION: Rotas HTTP para pagamentos dos budgets                 ║
   ║ CONSART ERP · Express · ESM                                         ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getBudgetPaymentById,
  listBudgetPaymentsByBudget,
  createBudgetPayment,
  updateBudgetPayment,
  deleteBudgetPayment,
  deleteBudgetPaymentsByBudget,
  regenerateInstallmentsByPayment,
  regenerateInstallmentsByBudget,
  validateBudgetPayments,
  replaceBudgetPayments
} from '../controllers/budgetsPaymentsController.js';

const router = Router();

/* ─────────────────────────────────────────────────────────────
 * AUTENTICAÇÃO — aplicada a TODAS as rotas deste router.
 *
 * Seguro usar router.use aqui porque o router é montado com prefixo
 * ('/api/budgets-payments'), então só o tráfego desse caminho passa por
 * aqui. NÃO usar esse padrão em routers montados na raiz.
 *
 * Antes de 16/09/2026 nenhuma destas 10 rotas exigia token — incluindo os
 * DELETE de pagamentos.
 * ───────────────────────────────────────────────────────────── */
router.use(requireAuth);

/* ─────────────────────────────────────────────────────────────
 * LISTAGEM
 * ───────────────────────────────────────────────────────────── */
router.get('/budget/:budgetId', listBudgetPaymentsByBudget);
router.get('/:id', getBudgetPaymentById);

/* ─────────────────────────────────────────────────────────────
 * CRUD
 * ───────────────────────────────────────────────────────────── */
router.post('/', createBudgetPayment);
router.put('/:id', updateBudgetPayment);
router.delete('/:id', deleteBudgetPayment);
router.delete('/budget/:budgetId/all', deleteBudgetPaymentsByBudget);

/* ─────────────────────────────────────────────────────────────
 * REPLACE / BATCH
 * ───────────────────────────────────────────────────────────── */
router.post('/budget/:budgetId/replace', replaceBudgetPayments);

/* ─────────────────────────────────────────────────────────────
 * VALIDAÇÃO
 * ───────────────────────────────────────────────────────────── */
router.get('/budget/:budgetId/validate', validateBudgetPayments);

/* ─────────────────────────────────────────────────────────────
 * PARCELAS
 * ───────────────────────────────────────────────────────────── */
router.post('/:id/regenerate-installments', regenerateInstallmentsByPayment);
router.post('/budget/:budgetId/regenerate-installments', regenerateInstallmentsByBudget);

export default router;
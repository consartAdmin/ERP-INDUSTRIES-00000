/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: debtPaymentsRoutes.js                                         ║
   ║ MODULE: Debt Payments Routes                                        ║
   ║ DESCRIPTION: Express routes for debt payments                       ║
   ║ CONSART ERP · Express · ESM                                         ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { Router } from 'express';
import {
  listDebtPayments,
  getDebtPaymentById,
  createDebtPayment,
  deleteDebtPayment,
  getDebtPaymentsSummary,
  getDebtPaymentsCashDefaults,
  updateDebtPayment,
  getDebtPaymentCash
} from '../controllers/debtPaymentsController.js';

const router = Router();

/* ──────────────────────────────────────────────────────────────────────
 * Nested by debt
 * ────────────────────────────────────────────────────────────────────── */

// Listar pagamentos de uma dívida
router.get('/debts/:debtId/payments', listDebtPayments);

// Resumo dos pagamentos da dívida
router.get('/debts/:debtId/payments/summary', getDebtPaymentsSummary);

// Classificação sugerida para a SAÍDA no caixa (Conta, Categoria, Conta Contábil)
router.get('/debts/:debtId/payments/cash-defaults', getDebtPaymentsCashDefaults);

// Criar pagamento para a dívida
router.post('/debts/:debtId/payments', createDebtPayment);

/* ──────────────────────────────────────────────────────────────────────
 * Direct payment routes
 * ────────────────────────────────────────────────────────────────────── */

// Buscar pagamento por ID
router.get('/debt-payments/:id', getDebtPaymentById);

// Classificação atual da SAÍDA no caixa do pagamento (edição)
router.get('/debt-payments/:id/cash', getDebtPaymentCash);

// Editar pagamento (atualiza também a movimentação no caixa)
router.put('/debt-payments/:id', updateDebtPayment);

// Excluir pagamento
router.delete('/debt-payments/:id', deleteDebtPayment);

export default router;
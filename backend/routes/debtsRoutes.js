/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: debtsRoutes.js                                                ║
   ║ MODULE: Debts Routes                                                ║
   ║ DESCRIPTION: Express routes for debts                               ║
   ║ CONSART ERP · Express · ESM                                         ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { Router } from 'express';
import {
  listDebts,
  getDebtById,
  createDebt,
  updateDebt,
  deleteDebt,
  getDebtsSummary,
  createDebtInstallments,
  getDebtInstallmentPlans,
  saveDebtInstallmentPlans,
  deleteDebtInstallmentPlan
} from '../controllers/debtsController.js';

const router = Router();

// List / summary
router.get('/debts', listDebts);
router.get('/debts/summary', getDebtsSummary);

router.get('/debts/:id/installment-plans', getDebtInstallmentPlans);
router.post('/debts/:id/installment-plans', saveDebtInstallmentPlans);
router.delete('/debts/:id/installment-plans/:planId', deleteDebtInstallmentPlan);

// CRUD
router.get('/debts/:id', getDebtById);
router.post('/debts', createDebt);
router.put('/debts/:id', updateDebt);
router.delete('/debts/:id', deleteDebt);

// Installments
router.post('/debts/installments', createDebtInstallments);

export default router;
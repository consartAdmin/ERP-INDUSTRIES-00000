// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expensesRoutes.js — Routes (Express)                                 ║
// ║ Base: /api/expenses                                                  ║
// ║ CONSART ERP | ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  getExpenses,
  getExpense,
  createExpenseHandler,
  updateExpenseHandler,
  patchExpenseStatusHandler,
  deleteExpenseHandler,
  getExpensesPdf, // ✅ ADD
} from '../controllers/expensesController.js';

const router = Router();

// ✅ MUITO IMPORTANTE: antes de "/:id"
router.get('/pdf', getExpensesPdf);

router.get('/', getExpenses);
router.get('/:id', getExpense);
router.post('/', createExpenseHandler);
router.put('/:id', updateExpenseHandler);
router.patch('/:id/status', patchExpenseStatusHandler);
router.delete('/:id', deleteExpenseHandler);

export default router;
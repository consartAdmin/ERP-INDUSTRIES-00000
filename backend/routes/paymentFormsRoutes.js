// ╔══════════════════════════════════════════════════════════════════════╗
// ║ paymentFormsRoutes.js — Rotas REST /api/paymentForms                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  listPaymentForms,
  getPaymentFormById,
  createPaymentForm,
  updatePaymentForm,
  deletePaymentForm
} from '../controllers/paymentFormsController.js';

const router = Router();

// GET /api/paymentForms
router.get('/', listPaymentForms);

// GET /api/paymentForms/:id
router.get('/:id', getPaymentFormById);

// POST /api/paymentForms
router.post('/', createPaymentForm);

// PUT /api/paymentForms/:id
router.put('/:id', updatePaymentForm);

// DELETE /api/paymentForms/:id
router.delete('/:id', deletePaymentForm);

export default router;

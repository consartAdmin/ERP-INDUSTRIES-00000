// ╔══════════════════════════════════════════════════════════════╗
// ║ deliveryLabelsRoutes.js — Rotas Etiquetas de Entrega        ║
// ║ CONSART ERP | ESM                                           ║
// ╚══════════════════════════════════════════════════════════════╝

import express from 'express';

import {
  create,
  list,
  getById,
  update,
  remove,
  importFromOrder,
  importFromBudget,
  importFromInvoice,
  printPdf,
  getSettings,
  updateSettings,
  previewSettings,
} from '../controllers/deliveryLabelsController.js';

const router = express.Router();

router.get('/', list);
router.get('/print/pdf', printPdf);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.post('/settings/preview', previewSettings);
router.get('/:id', getById);

router.post('/', create);
router.post('/from-order/:orderId', importFromOrder);
router.post('/from-budget/:budgetId', importFromBudget);
router.post('/from-invoice/:invoiceId', importFromInvoice);

router.put('/:id', update);
router.delete('/:id', remove);

export default router;
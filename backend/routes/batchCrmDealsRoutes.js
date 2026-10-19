// ╔══════════════════════════════════════════════════════════════╗
// ║ batchCrmDealsRoutes.js — Rotas CRM Deals em Lote            ║
// ║ CONSART ERP | ESM                                           ║
// ╚══════════════════════════════════════════════════════════════╝

import express from 'express';
import batchCrmDealsController from '../controllers/batchCrmDealsController.js';

const router = express.Router();

router.get('/customers/search', batchCrmDealsController.searchCustomers);
router.post('/create', batchCrmDealsController.createBatchDeals);

export default router;
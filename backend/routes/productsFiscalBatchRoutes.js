// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalBatchRoutes.js — Rotas de Vínculo Fiscal em Lote       ║
// ║ ESM | CONSART ERP                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';
import {
  listProductsFiscalBatch,
  batchLinkProductsFiscal,
} from '../controllers/productsFiscalBatchController.js';

const router = express.Router();

// GET /api/products/fiscal/batch-list
router.get('/products/fiscal/batch-list', listProductsFiscalBatch);

// POST /api/products/fiscal/batch-link
router.post('/products/fiscal/batch-link', batchLinkProductsFiscal);

export default router;

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBatchSupplierRoutes.js — Rotas Lote Fornecedor em Produtos  ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import { applySupplierBatch } from '../controllers/productsBatchSupplierController.js';

const router = Router();

// POST /api/products-batch-supplier
router.post('/', applySupplierBatch);

export default router;

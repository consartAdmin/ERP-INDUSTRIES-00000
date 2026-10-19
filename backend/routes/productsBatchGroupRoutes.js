// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBatchGroupRoutes.js — Rotas Lote Grupo em Produtos          ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import { applyGroupBatch } from '../controllers/productsBatchGroupController.js';

const router = Router();

// POST /api/products-batch-group
router.post('/', applyGroupBatch);

export default router;

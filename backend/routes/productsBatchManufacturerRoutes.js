// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBatchManufacturerRoutes.js — Rotas Lote Fabricante Produtos ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import { applyManufacturerBatch } from '../controllers/productsBatchManufacturerController.js';

const router = Router();

// POST /api/products-batch-manufacturer
router.post('/', applyManufacturerBatch);

export default router;

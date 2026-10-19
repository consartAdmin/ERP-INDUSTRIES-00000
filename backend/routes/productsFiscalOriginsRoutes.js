// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalOriginsRoutes.js — Rotas da origem fiscal do produto   ║
// ║ CONSART ERP — ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import {
    getProductsFiscalOriginsByProduct,
    resolveProductsFiscalOrigin,
    applyProductsFiscalOrigin,
    getProductsFiscalOriginById,
    deleteProductsFiscalOrigin,
} from '../controllers/productsFiscalOriginsController.js';

const router = Router();

// Rotas específicas devem permanecer antes de /:id.
router.get('/resolve/:productCode', resolveProductsFiscalOrigin);
router.post('/apply/:productCode', applyProductsFiscalOrigin);
router.get('/product/:productCode', getProductsFiscalOriginsByProduct);

router.get('/:id', getProductsFiscalOriginById);
router.delete('/:id', deleteProductsFiscalOrigin);

export default router;

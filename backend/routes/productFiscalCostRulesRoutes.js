// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productFiscalCostRulesRoutes.js — Rotas de regras de custo fiscal   ║
// ║ CONSART ERP — ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import {
    getProductFiscalCostRuleById,
    getProductFiscalCostRulesByProduct,
    getProductFiscalCostRulesByClassification,
    getProductFiscalCostRulesByProfile,
    resolveProductFiscalCostRule,
    createProductFiscalCostRule,
    updateProductFiscalCostRule,
    deleteProductFiscalCostRule,
    generateProductFiscalCostRule,
} from '../controllers/productFiscalCostRulesController.js';

const router = Router();

// Rotas específicas devem permanecer antes de /:id.
router.get('/resolve/:productCode', resolveProductFiscalCostRule);
router.post('/generate/:productCode', generateProductFiscalCostRule);

router.get('/product/:productCode', getProductFiscalCostRulesByProduct);
router.get(
    '/classification/:classificationId',
    getProductFiscalCostRulesByClassification,
);
router.get('/profile/:fiscalProfileId', getProductFiscalCostRulesByProfile);

router.post('/', createProductFiscalCostRule);

router.get('/:id', getProductFiscalCostRuleById);
router.put('/:id', updateProductFiscalCostRule);
router.patch('/:id', updateProductFiscalCostRule);
router.delete('/:id', deleteProductFiscalCostRule);

export default router;

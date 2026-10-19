'use strict';

import { Router } from 'express';

import {
    getConciliationSalesxStock,
    exportConciliationSalesxStockPdf,
    exportConciliationSalesxStockExcel,
} from '../controllers/conciliationSalesxStockController.js';

const router = Router();

/**
 * GET /api/reports/conciliation-sales-stock
 */
router.get(
    '/',
    getConciliationSalesxStock,
);

/**
 * GET /api/reports/conciliation-sales-stock/export/pdf
 */
router.get(
    '/export/pdf',
    exportConciliationSalesxStockPdf,
);

/**
 * GET /api/reports/conciliation-sales-stock/export/excel
 */
router.get(
    '/export/excel',
    exportConciliationSalesxStockExcel,
);

export default router;
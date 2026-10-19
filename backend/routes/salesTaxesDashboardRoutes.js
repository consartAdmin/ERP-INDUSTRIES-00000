// ╔══════════════════════════════════════════════════════════════════════╗
// ║ salesTaxesDashboardRoutes.js — Sales Taxes Dashboard Routes         ║
// ║ CONSART ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import {
    requireAuth,
} from '../middleware/authMiddleware.js';

import {
    getSalesTaxesDashboard,
} from '../controllers/salesTaxesDashboardController.js';


const router =
    Router();


// ======================================================================
// SALES TAXES
// ======================================================================
//
// GET /api/dashboard/sales-taxes?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
//
// ======================================================================

router.get(
    '/',
    requireAuth,
    getSalesTaxesDashboard
);


export default router;

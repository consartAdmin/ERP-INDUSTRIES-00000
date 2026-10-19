// ╔══════════════════════════════════════════════════════════════════════╗
// ║ salesAnalyticsRoutes.js — Sales Analytics Dashboard Routes         ║
// ║ CONSART ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import {
    requireAuth,
} from '../middleware/authMiddleware.js';

import {
    getSalesAnalytics,
} from '../controllers/salesAnalyticsController.js';


const router =
    Router();


// ======================================================================
// SALES ANALYTICS
// ======================================================================
//
// GET /api/dashboard/sales-analytics
//
// Optional query params:
//
// ?state=MG
// ?category=HIGIENE
//
// ======================================================================

router.get(
    '/',
    requireAuth,
    getSalesAnalytics
);


// ======================================================================
// EXPORT
// ======================================================================

export default router;
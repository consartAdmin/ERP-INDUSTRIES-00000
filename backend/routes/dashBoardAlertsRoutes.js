/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ dashBoardAlertsRoutes.js — Rotas Alertas Dashboard               ║
 * ║ CONSART ERP | ESM                                                ║
 * ╚══════════════════════════════════════════════════════════════════╝ */

import { Router } from 'express';
import { getDashboardAlerts } from '../controllers/dashBoardAlertsController.js';

const router = Router();

// GET /api/dashboard/alerts
router.get('/api/dashboard/alerts', getDashboardAlerts);

export default router;

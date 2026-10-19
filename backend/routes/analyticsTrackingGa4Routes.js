// ╔════════════════════════════════════════════════════════════════════╗
// ║ analyticsGa4Routes.js — GA4 Routes                                  ║
// ║ CONSART ERP | ESM                                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as controller from '../controllers/analyticsTrackingGa4Controller.js';

const router = Router();

// 🔴 Tempo real
router.get('/analytics/ga4/realtime', controller.realtime);

// 📊 Resumo
router.get('/analytics/ga4/summary', controller.summary);

export default router;

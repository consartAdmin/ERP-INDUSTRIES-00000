// ╔══════════════════════════════════════════════════════════════════════╗
// ║ trackingRoutes.js — Rotas /api/tracking                              ║
// ║ CONSART ERP · ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  getTrackingConfig,
  updateTrackingConfig,
  testTrackingConfig,
  serveEcommerceSnippet,
  getRealtimeEvents,              // ✅ ADD
} from '../controllers/trackingController.js';

const router = Router();

router.get('/config', getTrackingConfig);
router.put('/config', updateTrackingConfig);
router.post('/test', testTrackingConfig);
router.get('/snippet/ecommerce.js', serveEcommerceSnippet);

// ✅ ADD: realtime events + paginação (?before=...&limit=50)
router.get('/realtime-events', getRealtimeEvents);

export default router;

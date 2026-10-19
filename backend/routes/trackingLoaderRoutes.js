// ╔══════════════════════════════════════════════════════════════════════╗
// ║ trackingLoaderRoutes.js — Rotas de Tracking (Config + Loader + Test) ║
// ║ CONSART ERP · ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as trackingConfigController from '../controllers/trackingConfigController.js';
import * as trackingLoaderController from '../controllers/trackingLoaderController.js';
import * as trackingRealtimeController from '../controllers/trackingRealtimeController.js'; // ✅ ADD

const router = Router();

// Config (ERP)
router.get('/tracking/config', trackingConfigController.getConfig);
router.put('/tracking/config', trackingConfigController.putConfig);

// Teste (valida payload / e pode validar config salva)
router.post('/tracking/test', trackingConfigController.testConfig);

// Loader JS dinâmico (para o site BH3)
router.get('/tracking/loader.js', trackingLoaderController.loaderJs);

// Status público (opcional, só pra debug — sem secrets)
router.get('/tracking/status', trackingLoaderController.status);

/* --------------------------------------------------------------------- */
/* REALTIME (API + SSE)                                                  */
/* --------------------------------------------------------------------- */
router.post('/tracking/realtime/session', trackingRealtimeController.postSession);
router.post('/tracking/realtime/event', trackingRealtimeController.postEvent);

router.get('/tracking/realtime/online', trackingRealtimeController.getOnline);
router.get('/tracking/realtime/funnel', trackingRealtimeController.getFunnelStats);
router.get('/tracking/realtime/events-per-minute', trackingRealtimeController.getEventsMinute);

router.get('/tracking/realtime/stream', trackingRealtimeController.streamRealtime); // SSE

export default router;

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ trackingRealtimeRoutes.js — /api/tracking/realtime (SSE + REST)      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  postSession,
  postEvent,
  getOnline,
  getFunnelStats,
  getEventsMinute,
  streamRealtime,
} from '../controllers/trackingRealtimeController.js';

const router = Router();

router.post('/session', postSession);
router.post('/event', postEvent);

router.get('/online', getOnline);
router.get('/funnel', getFunnelStats);
router.get('/events-per-minute', getEventsMinute);

router.get('/stream', streamRealtime);

export default router;

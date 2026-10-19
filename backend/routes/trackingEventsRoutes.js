// ╔══════════════════════════════════════════════════════════════════════╗
// ║ trackingEventsRoutes.js — Tracking Realtime Routes                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import { getRealtimeEvents } from '../controllers/trackingEventsController.js';

const router = Router();

router.get('/tracking/realtime-events', getRealtimeEvents);

export default router;

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ trackingOverviewRoutes.js — Rotas Tracking Overview (MVs)            ║
// ║ CONSART ERP | ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as ctrl from '../controllers/trackingOverviewController.js';

const r = Router();

r.get('/tracking/overview', ctrl.overview);
r.get('/tracking/top-events', ctrl.topEvents);
r.get('/tracking/funnel', ctrl.funnel);
r.get('/tracking/realtime', ctrl.realtime);

export default r;

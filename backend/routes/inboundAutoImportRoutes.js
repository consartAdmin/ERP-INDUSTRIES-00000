/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ inboundAutoImportRoutes.js — NF-e Inbox → Inbound (auto-import) ║
 * ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

import { Router } from 'express';
import { autoImportFromDfe } from '../controllers/inboundAutoImportController.js';

const router = Router();

// POST /api/inbound/auto-from-dfe?accessKey=...
router.post('/api/inbound/auto-from-dfe', autoImportFromDfe);

export default router;
// ╔══════════════════════════════════════════════════════════════╗
// ║ FILE: auditLogsRoutes.js                                     ║
// ║ ROUTES: Auditoria                                            ║
// ╚══════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditLogsController.js';

const router = Router();

router.get('/', getAuditLogs);

export default router;
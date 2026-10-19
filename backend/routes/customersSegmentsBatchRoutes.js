// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ customersSegmentsBatchRoutes.js — Routes (Express)                           ║
// ║ Base: /api/customers/segments                                                ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as controller from '../controllers/customersSegmentsBatchController.js';

const router = Router();

router.get('/batch-list', controller.batchList);
router.post('/batch-apply', controller.batchApply);
router.post('/unlink', controller.unlink);

export default router;
import { Router } from 'express';
import { debugEmit } from '../controllers/nfesDiagnosticsController.js';

const router = Router();

// POST /api/nfes/debug/emit/:orderId
router.post('/debug/emit/:orderId', debugEmit);

export default router;

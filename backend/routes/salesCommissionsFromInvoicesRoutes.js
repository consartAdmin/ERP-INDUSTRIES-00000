// ╔══════════════════════════════════════════════════════════════════════╗
// ║ salesCommissionsFromInvoicesRoutes.js — Routes                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import {
  generate,
  recalc,
  diagnostics,
  items,
  pdf,
  excel,
} from '../controllers/salesCommissionsFromInvoicesController.js';

const router = Router();

router.post('/generate', generate);
router.post('/recalc', recalc);
router.get('/diagnostics', diagnostics);
router.get('/items', items);
router.get('/pdf', pdf);
router.get('/excel', excel);

export default router;
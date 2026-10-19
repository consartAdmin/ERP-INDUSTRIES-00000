// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ productsActiveBatchRoutes.js — Rotas Batch Active/Inactive (CONSART | ESM) ║
// ║ Mount no server.js: app.use('/api', productsActiveBatchRoutes)             ║
// ╚════════════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import {
  batchListProducts,
  batchSetActive,
  batchActivate,
  batchDeactivate,
} from '../controllers/productsActiveBatchController.js';

const router = Router();

router.get('/products-active/batch/list', batchListProducts);

router.post('/products-active/batch/set', batchSetActive);
router.post('/products-active/batch/activate', batchActivate);
router.post('/products-active/batch/deactivate', batchDeactivate);

export default router;

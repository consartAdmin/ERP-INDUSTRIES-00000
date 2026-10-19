// ╔══════════════════════════════════════════════════════════════════════╗
// ║ 🛣 labelsRoutes.js — Routes for Product Labels — CONSART ERP (ESM)  ║
// ║ - Mount under /api in server.js                                     ║
// ║ - POST /api/labels/products → generate Product Label PDF            ║
// ║ - GET  /api/labels/jobs (stub)                                      ║
// ║ - GET  /api/labels/jobs/:id (stub)                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  generateProductLabels,
  listLabelJobs,
  getLabelJob,
} from '../controllers/labelsController.js';

const router = Router();

// Generate labels for products
router.post('/labels/products', generateProductLabels);

// Optional stubs for future use
router.get('/labels/jobs', listLabelJobs);
router.get('/labels/jobs/:id', getLabelJob);

export default router;

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ crmDealsReativationPerformanceRoutes.js — CRM Performance Routes     ║
// ║ CONSART ERP | ESM                                                   ║
// ║                                                                      ║
// ║ Base: /api/crm/reativacao                                            ║
// ║   GET  /performance                                                  ║
// ║   GET  /actions                                                      ║
// ║   GET  /actions.xlsx   (export Excel)                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  getPerformance,
  listActions,
} from '../controllers/crmDealsPerformanceController.js';

// ✅ Export Excel separado (novo arquivo)
import {
  exportCrmDealsReativationPerformanceExcel,
} from '../generationExcel/generationCrmDealsPerformanceExcel.js';

const router = Router();

// Base: /api/crm/reativacao
router.get('/performance', getPerformance);
router.get('/actions', listActions);

// ✅ Excel (download)
router.get('/actions.xlsx', exportCrmDealsReativationPerformanceExcel);

export default router;

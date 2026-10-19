// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: salesPerformanceRoutes.js                                     ║
// ║ MODULE: Sales Performance                                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import {
  getSalesPerformanceSellers,
  getSalesPerformanceStatusTypes,
  getSalesPerformanceMovements,
  getSalesPerformanceByStatus,
  getSalesPerformanceLeadsAttended,
  generateSalesPerformancePdfController
} from '../controllers/salesPerformanceController.js';

const router = Router();

router.get('/vendedores', getSalesPerformanceSellers);

router.get('/status-types', getSalesPerformanceStatusTypes);

router.get('/status-summary', getSalesPerformanceByStatus);

router.get('/leads/atendidos', getSalesPerformanceLeadsAttended);

/* PDF */
router.post('/pdf', generateSalesPerformancePdfController);

router.get('/', getSalesPerformanceMovements);

export default router;
/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: customerActivityRoutes.js                                     ║
   ║ MODULE: Customer Activity                                           ║
   ║ DESCRIPTION: Rotas do módulo customerActivity                       ║
   ║ CONSART ERP · Express · ESM                                         ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { Router } from 'express';
import {
  listCustomerActivityController,
  getCustomerActivityByCustomerIdController,
  ensureCustomerActivityController,
  updateCustomerActivityController,
  registerCustomerFollowupController,
  recalculateCustomerActivityController,
  getCustomerActivitySummaryController,
  applyCrmOutcomeController,
} from '../controllers/customerActivityController.js';

const router = Router();

router.get('/', listCustomerActivityController);
router.get('/summary', getCustomerActivitySummaryController);
router.get('/customer/:customerId', getCustomerActivityByCustomerIdController);

router.post('/ensure', ensureCustomerActivityController);
router.post('/recalculate', recalculateCustomerActivityController);
router.post('/apply-crm-outcome', applyCrmOutcomeController);
router.post('/customer/:customerId/followup', registerCustomerFollowupController);

router.put('/customer/:customerId', updateCustomerActivityController);

export default router;
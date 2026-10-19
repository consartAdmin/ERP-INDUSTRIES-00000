/*||============================================================||
  ||------------------------------------------------------------||
  ||-------- crmLossReasonsRoutes.js ---------------------------||
  ||------------------------------------------------------------||
  || Routes for CRM Loss Reasons                               ||
  || CONSART ERP                                               ||
  ||============================================================||*/

import { Router } from 'express';
import crmLossReasonsController from '../controllers/crmLossReasonsController.js';

const router = Router();

/*================================================
 * ROUTES
 *================================================*/

// GET /api/crm-loss-reasons?onlyActive=true
router.get('/', crmLossReasonsController.list);

// GET /api/crm-loss-reasons/:id
router.get('/:id', crmLossReasonsController.getById);

// POST /api/crm-loss-reasons
router.post('/', crmLossReasonsController.create);

export default router;
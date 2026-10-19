/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║ crmDealsOutcomesRoutes.js                                           ║
 * ║ CONSART ERP — Rotas de resultados de negociações CRM                ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { Router } from 'express';
import {
  getCrmDealsOutcomes,
  getCrmDealsOutcomesSummaryController,
  getCrmDealsOutcomeController,
  getCrmDealsOutcomeByCodeController,
  createCrmDealsOutcomeController,
  updateCrmDealsOutcomeController,
  deleteCrmDealsOutcomeController,
  getOperationsByOutcomeIdController,
  getOperationsByOutcomeCodeController
} from '../controllers/crmDealsOutcomesController.js';
import { erpCompanyContext } from '../utils/erpCompanyContext.js';

const router = Router();

// Empresa da tela (BH3 x CONSART) também aqui, além do middleware global
router.use(erpCompanyContext);

/* =======================================================================
 * CATALOG
 * ======================================================================= */

router.get('/crm/deals-outcomes', getCrmDealsOutcomes);
router.get('/crm/deals-outcomes/summary', getCrmDealsOutcomesSummaryController);
router.get('/crm/deals-outcomes/code/:code', getCrmDealsOutcomeByCodeController);
router.get('/crm/deals-outcomes/:id', getCrmDealsOutcomeController);

router.post('/crm/deals-outcomes', createCrmDealsOutcomeController);
router.put('/crm/deals-outcomes/:id', updateCrmDealsOutcomeController);
router.delete('/crm/deals-outcomes/:id', deleteCrmDealsOutcomeController);

/* =======================================================================
 * OPERATIONS
 * ======================================================================= */

router.get('/crm/deals-outcomes/:id/operations', getOperationsByOutcomeIdController);
router.get('/crm/deals-outcomes/code/:code/operations', getOperationsByOutcomeCodeController);

export default router;
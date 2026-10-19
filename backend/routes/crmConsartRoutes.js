// ╔══════════════════════════════════════════════════════════════════════╗
// ║ crmConsartReativacaoRoutes.js — Rotas CRM Reativação (CONSART ERP)  ║
// ║ ESM + Express.Router                                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import crmConsartReativacaoController from '../controllers/crmConsartController.js';

const router = Router();

// ========================== STAGES ======================================
// GET /api/crm/reativacao/stages
router.get(
  '/crm/reativacao/stages',
  crmConsartReativacaoController.listStages
);

// ========================== DEALS =======================================
// GET /api/crm/reativacao/deals
router.get(
  '/crm/reativacao/deals',
  crmConsartReativacaoController.listDeals
);

// GET /api/crm/reativacao/deals/:id
router.get(
  '/crm/reativacao/deals/:id',
  crmConsartReativacaoController.getDeal
);

// POST /api/crm/reativacao/deals
router.post(
  '/crm/reativacao/deals',
  crmConsartReativacaoController.createDeal
);

// PATCH /api/crm/reativacao/deals/:id
router.patch(
  '/crm/reativacao/deals/:id',
  crmConsartReativacaoController.updateDeal
);

// PATCH /api/crm/reativacao/deals/:id/move
router.patch(
  '/crm/reativacao/deals/:id/move',
  crmConsartReativacaoController.moveDeal
);

// DELETE /api/crm/reativacao/deals/:id
router.delete(
  '/crm/reativacao/deals/:id',
  crmConsartReativacaoController.deleteDeal
);

// ======================= OUTCOME (CONVERSÃO / QUEDA) ====================
// POST /api/crm/reativacao/deals/:id/outcome
router.post(
  '/crm/reativacao/deals/:id/outcome',
  crmConsartReativacaoController.registerOutcome
);

// GET /api/crm/reativacao/outcomes/summary
router.get(
  '/crm/reativacao/outcomes/summary',
  crmConsartReativacaoController.summaryOutcomes
);

export default router;

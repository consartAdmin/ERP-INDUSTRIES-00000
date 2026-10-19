// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: googleAdsRoutes.js                                            ║
// ║ MODULE: Google Ads Manual Input                                     ║
// ║ CONSART ERP                                                         ║
// ║ Descrição: rotas do módulo Google Ads com alimentação manual.       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  listResource,
  getResourceById,
  createResource,
  updateResource,
  deleteResource,
  getDashboardSummary,
  getCampaignPerformance,
  getDailySeries,
} from '../controllers/googleAdsController.js';

// Se você usa autenticação no ERP, descomente a linha abaixo:
// import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Se quiser proteger tudo:
// router.use(requireAuth);

/* ============================================================================
 * DASHBOARD / RELATÓRIOS
 * ========================================================================== */

router.get('/dashboard/summary', getDashboardSummary);
router.get('/dashboard/campaign-performance', getCampaignPerformance);
router.get('/dashboard/daily-series', getDailySeries);

/* ============================================================================
 * CRUD GENÉRICO POR RECURSO
 * ========================================================================== */

router.get('/:resource', listResource);
router.get('/:resource/:id', getResourceById);
router.post('/:resource', createResource);
router.put('/:resource/:id', updateResource);
router.delete('/:resource/:id', deleteResource);

export default router;
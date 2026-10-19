/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ crmDealsStagesRoutes.js                                                 ║
 * ║ Rotas de Etapas do CRM                                                  ║
 * ║ CONSART ERP | Backend ESM + Express                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝ */

import { Router } from 'express';
import {
  getCrmDealsStages,
  getCrmDealsStageById,
  postCrmDealsStage,
  putCrmDealsStage,
  deleteCrmDealsStage,
} from '../controllers/crmDealsStagesController.js';

const router = Router();

/* ========================================================================== */
/* ROUTES                                                                     */
/* ========================================================================== */

router.get('/', getCrmDealsStages);
router.get('/:id', getCrmDealsStageById);
router.post('/', postCrmDealsStage);
router.put('/:id', putCrmDealsStage);
router.delete('/:id', deleteCrmDealsStage);

export default router;
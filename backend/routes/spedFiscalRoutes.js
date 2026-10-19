// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscalRoutes.js                                                 ║
// ║ Descrição: Rotas do módulo SPED Fiscal                              ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  previewSpedFiscal,
  validateSpedFiscal,
  generateSpedFiscal,
  downloadSpedFiscal,
} from '../controllers/spedFiscalController.js';

const router = Router();

router.get('/preview', previewSpedFiscal);
router.post('/validate', validateSpedFiscal);
router.post('/generate', generateSpedFiscal);
router.get('/:id/download', downloadSpedFiscal);

export default router;
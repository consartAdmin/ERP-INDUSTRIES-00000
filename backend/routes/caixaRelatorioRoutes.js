// ╔═════════════════════════════════════════╗
// ║ caixaRelatorioRoutes.js (ESM/Express)   ║
// ╚═════════════════════════════════════════╝

import { Router } from 'express';
import { relatorioCaixaPdf } from '../controllers/caixaRelatorioController.js';

const router = Router();

// Apenas rota de relatório PDF
router.get('/caixa/relatorio/pdf', relatorioCaixaPdf);

export default router;
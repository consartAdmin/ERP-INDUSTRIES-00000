// ╔════════════════════════════════════════════════════════════════════════╗
// ║ 🚏 entradasFiscaisRoutes.js – Rotas para Importação de NF-e de Entrada ║
// ╚════════════════════════════════════════════════════════════════════════╝

import express from 'express';
import * as controller from '../controllers/entradasFiscaisController.js';

const router = express.Router();

// 🔄 POST /api/entradas/importar – Importa NF-e com produtos e duplicatas
router.post('/importar', controller.importarNotaFiscal);

export default router;

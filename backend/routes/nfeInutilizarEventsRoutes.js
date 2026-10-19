// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: nfeInutilizarEventsRoutes.js                                  ║
// ║ MODULE: NF-e Inutilization Events Routes                            ║
// ║ CONSART ERP                                                         ║
// ║ ✔ Rotas completas: create + list + get + consultar                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';
import {
  createInutilizacao,
  listarInutilizacoes,
  buscarInutilizacaoPorId,
  consultarStatusInutilizacao,
} from '../controllers/nfeInutilizarEventsController.js';

const router = express.Router();

/**
 * Base esperada no server:
 *   app.use('/api/nfes', router);
 *
 * Rotas finais:
 *   POST /api/nfes/inutilizar
 *   GET  /api/nfes/inutilizar
 *   GET  /api/nfes/inutilizar/:id
 *   GET  /api/nfes/inutilizar/:id/consultar
 */

router.post('/inutilizar', createInutilizacao);
router.get('/inutilizar', listarInutilizacoes);
router.get('/inutilizar/:id', buscarInutilizacaoPorId);
router.get('/inutilizar/:id/consultar', consultarStatusInutilizacao);

export default router;
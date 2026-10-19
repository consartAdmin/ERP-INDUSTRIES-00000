/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCceRoutes.js                                               ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                  ║
   ║ DESCRIPTION: Rotas Express da CC-e                                  ║
   ║ CONSART ERP · Node.js · Express · ESM                               ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { Router } from 'express';
import {
  emitirCce,
  consultarStatusCce,
  obterPdfCce,
  obterXmlCce,
  listarEventosCce,
  listarEventosCcePorOrder,
} from '../controllers/nfeCceController.js';

const router = Router();

/* =========================================================================
 * 📤 Emitir CC-e
 * POST /api/nfe/cce
 * ========================================================================= */
router.post('/cce', emitirCce);

/* =========================================================================
 * 🔍 Consultar status da CC-e
 * GET /api/nfe/cce/status/:idOuChaveOuProtocolo
 * ========================================================================= */
router.get('/cce/status/:idOuChaveOuProtocolo', consultarStatusCce);

/* =========================================================================
 * 🧾 PDF da CC-e
 * GET /api/nfe/cce/pdf/:idOuChave
 * ========================================================================= */
router.get('/cce/pdf/:idOuChave', obterPdfCce);

/* =========================================================================
 * 🧾 XML da CC-e
 * GET /api/nfe/cce/xml/:idOuChaveOuProtocolo
 * ========================================================================= */
router.get('/cce/xml/:idOuChaveOuProtocolo', obterXmlCce);

/* =========================================================================
 * 📋 Histórico de CC-e por pedido
 * GET /api/nfe/cce/order/:orderId
 * ========================================================================= */
router.get('/cce/order/:orderId', listarEventosCcePorOrder);

/* =========================================================================
 * 📋 Histórico genérico (querystring)
 * GET /api/nfe/cce/eventos?nfeKey=...&orderId=...
 * ========================================================================= */
router.get('/cce/eventos', listarEventosCce);

/* =========================================================================
 * 📋 Histórico por NF-e (rota alternativa)
 * GET /api/nfe/cce/:idOuChave/eventos
 * ========================================================================= */
router.get('/cce/:idOuChave/eventos', listarEventosCce);

/* =========================================================================
 * 📦 EXPORT
 * ========================================================================= */
export default router;
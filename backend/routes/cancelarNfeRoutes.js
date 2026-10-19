// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfeRoutes.js — Rotas Cancelamento NF-e                      ║
// ║ CONSART ERP — ESM                                                   ║
// ║ Rotas:                                                              ║
// ║  POST   /api/nfe/cancelar                                           ║
// ║  GET    /api/nfe/status/:id                                         ║
// ║  GET    /api/nfe/cancelamento/:id/status                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import {
  cancelarNfeController,
  consultarStatusNfeController,
  consultarStatusCancelamentoController,
} from '../controllers/cancelarNfeController.js';

const router = Router();

/* =========================================================================
 * 🚫 Cancelar NF-e
 * ========================================================================= */
router.post('/cancelar', cancelarNfeController);

/* =========================================================================
 * 🔍 Consultar Status NF-e
 * ========================================================================= */
router.get('/status/:id', consultarStatusNfeController);

/* =========================================================================
 * 🔁 Consultar Status do Cancelamento (polling)
 * ========================================================================= */
router.get('/cancelamento/:id/status', consultarStatusCancelamentoController);

export default router;
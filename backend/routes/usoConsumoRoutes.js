// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usoConsumoRoutes.js — Routes Uso e Consumo                          ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import {
  list,
  getById,
  finishBudget,
  emitNfe,
  refreshNfeStatus,
  retryNfe,
  printDanfe,
} from '../controllers/usoConsumoController.js';

const router = Router();

/* =========================================================================
 * 📋 Listagem
 *
 * GET /api/uso-consumo
 * ========================================================================= */

router.get(
  '/',
  list
);

/* =========================================================================
 * ✅ Finalizar orçamento
 *
 * POST /api/uso-consumo/finish-budget/1064
 * ========================================================================= */

router.post(
  '/finish-budget/:budgetId',
  finishBudget
);

router.post(
  '/:id/nfe/retry',
  retryNfe
);

/* =========================================================================
 * 🧾 Emitir NF-e
 *
 * POST /api/uso-consumo/1/emit-nfe
 * ========================================================================= */

router.post(
  '/:id/emit-nfe',
  emitNfe
);

/* =========================================================================
 * 🔄 Consultar e atualizar status da NF-e
 *
 * GET /api/uso-consumo/1/nfe/status
 * ========================================================================= */

router.get(
  '/:id/nfe/status',
  refreshNfeStatus
);

router.get(
  '/:id/nfe/danfe-consart',
  printDanfe
);

/* =========================================================================
 * 🔎 Buscar registro
 *
 * GET /api/uso-consumo/1
 *
 * A rota dinâmica simples fica por último.
 * ========================================================================= */

router.get(
  '/:id',
  getById
);

export default router;
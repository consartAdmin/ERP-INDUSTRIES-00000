// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsRoutes.js — Rotas Express de Orçamentos (ESM) — CONSART ERP ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import { requireBudgetToOrderKey } from '../middleware/requireBudgetToOrderKey.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getMySeller } from '../controllers/meController.js';
import {
  initBudgetsController,
  searchBudgets,
  listBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
  transformBudgetToOrder,
  getBudgetPdf,
  copyBudget,
  validateStockOverride,
  validateStockOverrideBatch,
  getStockOverrideStatus,
  getCustomerStatus,
} from '../controllers/budgetsController.js';
const router = Router();

function setNoCache(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function noCache(handler) {
  return (req, res, next) => {
    setNoCache(res);
    return Promise.resolve(handler(req, res, next)).catch(next);
  };
}

try {
  await initBudgetsController?.();
} catch (error) {
  console.error('[budgetsRoutes] initBudgetsController failed:', error);
}

/*
 * requireAuth vai rota por rota AQUI de propósito: este router é montado na
 * raiz (`app.use(budgetsRoutes)` no server.js), então um `router.use(requireAuth)`
 * interceptaria TODO o tráfego da aplicação, não apenas /api/budgets.
 *
 * Os 4 GETs abaixo estavam sem autenticação até 16/09/2026 — era possível
 * listar todos os orçamentos com nome, CNPJ, e-mail, telefone e valores dos
 * clientes sem token. As escritas já eram protegidas.
 */
router.get('/api/budgets/search', requireAuth, noCache(searchBudgets));
router.get('/api/budgets', requireAuth, noCache(listBudgets));
router.get('/api/budgets/stock-override-status', requireAuth, noCache(getStockOverrideStatus));
router.get('/api/customers/:customer_id/status', requireAuth, noCache(getCustomerStatus));
router.get('/api/budgets/:id', requireAuth, noCache(getBudgetById));
router.get('/api/budgets/:id/pdf', requireAuth, noCache(getBudgetPdf));

router.get('/api/me/seller', requireAuth, getMySeller);
router.post('/api/budgets/validate-stock-override', requireAuth, noCache(validateStockOverride));
router.post('/api/budgets/validate-stock-override-batch', requireAuth, noCache(validateStockOverrideBatch));
router.post('/api/budgets', requireAuth, noCache(createBudget));
router.put('/api/budgets/:id', requireAuth, noCache(updateBudget));
router.delete('/api/budgets/:id', requireAuth, noCache(deleteBudget));

router.post('/api/budgets/:id/copy', requireAuth, noCache(copyBudget));

router.post(
  '/api/budgets/:id/to-order',
  requireAuth,
  requireBudgetToOrderKey,
  noCache(transformBudgetToOrder),
);

export default router;

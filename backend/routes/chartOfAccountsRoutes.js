/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: chartOfAccountsRoutes.js                                      ║
   ║ MODULE: Chart Of Accounts                                           ║
   ║ DESCRIPTION: Express routes for public."chartOfAccounts"            ║
   ║ CONSART ERP · Express · ESM                                         ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { Router } from 'express';
import chartOfAccountsController from '../controllers/chartOfAccountsController.js';

const router = Router();

/* ──────────────────────────────────────────────────────────────────────
 * Bootstrap / readiness
 * ────────────────────────────────────────────────────────────────────── */
router.use(chartOfAccountsController.ensureReady);

/* ──────────────────────────────────────────────────────────────────────
 * Lookup / tree / search
 * Keep these routes before "/:id" to avoid path conflicts
 * ────────────────────────────────────────────────────────────────────── */
router.get('/tree', chartOfAccountsController.getTree);
router.get('/flat', chartOfAccountsController.getFlatHierarchy);
router.get('/search', chartOfAccountsController.searchAccounts);
router.get('/posting', chartOfAccountsController.listPostingAccounts);
router.get('/code/:code', chartOfAccountsController.getAccountByCode);

/* ──────────────────────────────────────────────────────────────────────
 * CRUD
 * ────────────────────────────────────────────────────────────────────── */
router.get('/', chartOfAccountsController.listAccounts);
router.get('/:id', chartOfAccountsController.getAccountById);
router.post('/', chartOfAccountsController.createAccount);
router.put('/:id', chartOfAccountsController.updateAccount);
router.patch('/:id/active', chartOfAccountsController.setAccountActiveState);
router.patch('/:id/activate', chartOfAccountsController.activateAccount);
router.patch('/:id/deactivate', chartOfAccountsController.deactivateAccount);
router.delete('/:id', chartOfAccountsController.deleteAccount);

export default router;
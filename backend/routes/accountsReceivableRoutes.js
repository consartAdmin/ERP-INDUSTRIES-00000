// ╔══════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableRoutes.js — Rotas REST                        ║
// ║ CONSART ERP — /api/accounts-receivable                          ║
// ╚══════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';

import * as ctrl
   from '../controllers/accountsReceivableController.js';

const router = express.Router();

/* ------------------------------------------------------------------
   LISTA
------------------------------------------------------------------ */

router.get('/', ctrl.list);

/* ------------------------------------------------------------------
   ROTAS FIXAS — devem vir antes de /:id
------------------------------------------------------------------ */

router.get('/bank-accounts', ctrl.bankAccounts);
router.get('/cash-categories', ctrl.cashCategories);
router.get('/cash-subcategories', ctrl.cashSubcategories);
router.get('/cash-document-types', ctrl.cashDocumentTypes);
router.get('/chart-of-accounts', ctrl.chartOfAccounts);
router.get('/export/pdf', ctrl.exportPdf);
router.get('/export/excel', ctrl.exportExcel);
router.post('/sync-asaas', ctrl.syncAsaasHandler);

/* ------------------------------------------------------------------
   BOLETO
------------------------------------------------------------------ */

router.get('/:id/boleto', ctrl.downloadBoleto);
router.patch('/:id/boleto', ctrl.updateBoleto);
router.delete('/:id/boleto', ctrl.cancelBoleto);

/* ------------------------------------------------------------------
   CRUD
------------------------------------------------------------------ */

router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);

/* ------------------------------------------------------------------
   RECEBIMENTO
------------------------------------------------------------------ */

router.post('/:id/receive', ctrl.receive);

export default router;
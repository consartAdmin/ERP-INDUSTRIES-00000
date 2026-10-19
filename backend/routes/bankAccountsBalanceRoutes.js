// ╔══════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsBalanceRoutes.js — Rotas de Saldos / Conferências        ║
// ║ CONSART ERP | /api/bank-accounts-balance                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';
import * as ctrl from '../controllers/bankAccountsBalanceController.js';

const router = express.Router();

router.get('/summary', ctrl.summary);
router.get('/calculate', ctrl.calculate);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;

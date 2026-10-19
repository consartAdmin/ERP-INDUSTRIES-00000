// ╔══════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsRoutes.js — Rotas REST de contas bancárias             ║
// ║ CONSART ERP | /api/bank-accounts                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';
import * as ctrl from '../controllers/bankAccountsController.js';

const router = express.Router();

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;

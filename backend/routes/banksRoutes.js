// ╔══════════════════════════════════════════════════════════════════════╗
// ║ banksRoutes.js — Rotas REST de bancos                             ║
// ║ CONSART ERP | /api/banks                                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';
import * as ctrl from '../controllers/banksController.js';

const router = express.Router();

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ taxRegimesRoutes.js — Rotas: Regime Tributário                      ║
// ║ CONSART ERP | Base: /api/tax-regimes                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import { requireAuth } from '../middleware/authMiddleware.js';

import {
    create,
    getById,
    list,
    options,
    setActive,
    update,
} from '../controllers/taxRegimesController.js';

const router = Router();

router.use(requireAuth);

router.get('/', list);
router.get('/options', options);
router.get('/:id', getById);
router.post('/', create);
router.put('/:id', update);
router.patch('/:id/active', setActive);

export default router;

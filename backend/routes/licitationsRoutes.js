// ╔══════════════════════════════════════════════════════════════════════╗
// ║ licitationsRoutes.js — Rotas de Licitações                          ║
// ║ CONSART ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import {
    changeStatus,
    diagnose,
    create,
    getById,
    initializeLicitations,
    list,
    remove,
    summary,
    update,
} from '../controllers/licitationsController.js';

const router = Router();

/**
 * Base esperada no servidor:
 * app.use('/api/licitations', licitationsRoutes);
 */

router.get('/diagnose', diagnose);
router.post('/initialize', initializeLicitations);

router.get('/summary', summary);
router.get('/', list);
router.get('/:id', getById);

router.post('/', create);
router.put('/:id', update);
router.patch('/:id/status', changeStatus);

router.delete('/:id', remove);

export default router;

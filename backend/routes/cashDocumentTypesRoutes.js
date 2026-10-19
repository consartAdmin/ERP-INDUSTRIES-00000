// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cashDocumentTypesRoutes.js — Rotas: Tipos de Documento do Caixa    ║
// ║ CONSART ERP | Base sugerida: /api/cash-document-types               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import {
    create,
    getById,
    list,
    remove,
    setActive,
    setup,
    toggleActive,
    update,
} from '../controllers/cashDocumentTypesController.js';

const router = Router();

router.get('/', list);
router.get('/:id', getById);
router.post('/', create);
router.put('/:id', update);
router.patch('/:id/active', setActive);
router.patch('/:id/toggle-active', toggleActive);
router.delete('/:id', remove);

// Execute apenas em ambiente administrativo/controlado.
router.post('/setup/seed', setup);

export default router;

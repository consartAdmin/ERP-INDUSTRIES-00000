// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeStatusMapRoutes.js — Rotas do mapa de status NF-e              ║
// ║ CONSART ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';

import {
    listNfeStatuses,
    getNfeStatusById,
    getNfeStatusByCode,
} from '../controllers/nfeStatusMapController.js';

const router = express.Router();

router.get('/', listNfeStatuses);

router.get('/code/:code', getNfeStatusByCode);

router.get('/:id', getNfeStatusById);

export default router;
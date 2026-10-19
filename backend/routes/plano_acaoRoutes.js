/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║ plano_acaoRoutes.js — Rotas Plano de Ação | CONSART ERP (ESM)        ║
 * ║ Path: backend/routes/plano_acaoRoutes.js                             ║
 * ║ Base: /api/plano-acao                                                ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */

import { Router } from 'express';
import * as c from '../controllers/plano_acaoController.js';

const router = Router();

// Listagem (filtros/paginação)
router.get('/', c.list);

// Bulk import/upsert (excel)
router.post('/bulk', c.bulkUpsert);

// CRUD
router.get('/:id', c.getById);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

export default router;

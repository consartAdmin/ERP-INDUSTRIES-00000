// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ groupsAndSubgroupsBatchRoutes.js — Rotas Batch (Grupo/Subgrupo)            ║
// ║ CONSART ERP | ESM                                                          ║
// ║                                                                            ║
// ║ Base: app.use('/api', router)                                              ║
// ║                                                                            ║
// ║ Endpoints:                                                                 ║
// ║   GET  /api/products-groups/batch/list                                     ║
// ║   POST /api/products-groups/batch/assign                                   ║
// ║   POST /api/products-groups/batch/clear                                    ║
// ╚════════════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import {
  listBatchProducts,
  assignBatchGroups,
  clearBatchGroups,
} from '../controllers/groupsAndSubgroupsBatchController.js';

const router = Router();

/* ──────────────────────────────────────────────────────────────
   LISTAGEM (USADO PELO FRONT + FILTRO "linked")
───────────────────────────────────────────────────────────── */
router.get('/products-groups/batch/list', listBatchProducts);

/* ──────────────────────────────────────────────────────────────
   BATCH ASSIGN
───────────────────────────────────────────────────────────── */
router.post('/products-groups/batch/assign', assignBatchGroups);

/* ──────────────────────────────────────────────────────────────
   BATCH CLEAR
───────────────────────────────────────────────────────────── */
router.post('/products-groups/batch/clear', clearBatchGroups);

export default router;

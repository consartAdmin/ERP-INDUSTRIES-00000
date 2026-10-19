// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsSubgroupsRoutes.js — Rotas HTTP Subgrupos de Produtos       ║
// ║ Montadas em /api no server.js                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import productsSubgroupsController from '../controllers/productsSubgroupsController.js';

const router = Router();

// opcional: rota para garantir tabela
router.post(
  '/products-subgroups/ensure-table',
  productsSubgroupsController.ensureTable
);

// CRUD básico
router.get('/products-subgroups', productsSubgroupsController.list);
router.get('/products-subgroups/:id', productsSubgroupsController.getById);
router.post('/products-subgroups', productsSubgroupsController.create);
router.put('/products-subgroups/:id', productsSubgroupsController.update);
router.put(
  '/products-subgroups/:id/deactivate',
  productsSubgroupsController.deactivate
);
router.delete('/products-subgroups/:id', productsSubgroupsController.remove);

// upsert por nome
router.post(
  '/products-subgroups/upsert',
  productsSubgroupsController.upsertByName
);

export default router;

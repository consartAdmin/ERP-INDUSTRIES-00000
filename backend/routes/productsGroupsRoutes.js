// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsGroupsRoutes.js — Rotas HTTP Grupos de Produtos             ║
// ║ Montadas em /api no server.js                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import productsGroupsController from '../controllers/productsGroupsController.js';

const router = Router();

// opcional: rota para garantir tabela
router.post(
  '/products-groups/ensure-table',
  productsGroupsController.ensureTable
);

// CRUD básico
router.get('/products-groups', productsGroupsController.list);
router.get('/products-groups/:id', productsGroupsController.getById);
router.post('/products-groups', productsGroupsController.create);
router.put('/products-groups/:id', productsGroupsController.update);
router.put(
  '/products-groups/:id/deactivate',
  productsGroupsController.deactivate
);
router.delete('/products-groups/:id', productsGroupsController.remove);

// upsert por nome (útil para imports)
router.post(
  '/products-groups/upsert',
  productsGroupsController.upsertByName
);

export default router;

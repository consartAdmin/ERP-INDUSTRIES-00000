// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsManufacturersRoutes.js — Rotas de Fabricantes (CONSART ERP) ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import manufacturersController from '../controllers/productsManufacturersController.js';

const router = Router();

// GET /api/products-manufacturers
router.get('/products-manufacturers', manufacturersController.list);

// GET /api/products-manufacturers/:id
router.get('/products-manufacturers/:id', manufacturersController.getById);

// POST /api/products-manufacturers
router.post('/products-manufacturers', manufacturersController.create);

// PUT /api/products-manufacturers/:id
router.put('/products-manufacturers/:id', manufacturersController.update);

// PUT /api/products-manufacturers/:id/deactivate (opcional)
router.put('/products-manufacturers/:id/deactivate', manufacturersController.deactivate);

// DELETE /api/products-manufacturers/:id
router.delete('/products-manufacturers/:id', manufacturersController.remove);

export default router;

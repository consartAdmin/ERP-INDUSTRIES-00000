// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsSuppliersRoutes.js — Rotas de Fornecedores (CONSART ERP)    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import suppliersController from '../controllers/productsSuppliersController.js';

const router = Router();

// GET /api/products-suppliers
router.get('/products-suppliers', suppliersController.list);

// GET /api/products-suppliers/:id
router.get('/products-suppliers/:id', suppliersController.getById);

// POST /api/products-suppliers
router.post('/products-suppliers', suppliersController.create);

// PUT /api/products-suppliers/:id
router.put('/products-suppliers/:id', suppliersController.update);

// PUT /api/products-suppliers/:id/deactivate
router.put('/products-suppliers/:id/deactivate', suppliersController.deactivate);

// DELETE /api/products-suppliers/:id
router.delete('/products-suppliers/:id', suppliersController.remove);

export default router;

// ╔══════════════════════════════════════════════════════════════╗
// ║ productsDescriptionsRoutes.js — CONSART ERP (ESM)           ║
// ║ Mount: app.use('/api', productsDescriptionsRoutes)          ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import * as controller from '../controllers/productsDescriptionsController.js';

const router = Router();

/**
 * GET  /api/products-descriptions?q=&product_code=&is_active=&limit=&offset=
 * GET  /api/products-descriptions/:id
 * POST /api/products-descriptions
 * PUT  /api/products-descriptions/:id
 * PATCH /api/products-descriptions/:id/deactivate   (soft delete)
 * DELETE /api/products-descriptions/:id             (físico)
 */

router.get('/products-descriptions', controller.list);
router.get('/products-descriptions/:id', controller.getById);

router.post('/products-descriptions', controller.create);
router.put('/products-descriptions/:id', controller.update);

router.patch('/products-descriptions/:id/deactivate', controller.deactivate);
router.delete('/products-descriptions/:id', controller.remove);

export default router;

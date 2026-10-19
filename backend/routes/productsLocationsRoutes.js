// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocationsRoutes.js — Rotas Products Locations (CONSART | ESM)║
// ║ Base: /api/products-locations                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import {
  list,
  listByProduct,
  getById,
  create,
  update,
  deactivate,
  remove,
} from '../controllers/productsLocationsController.js';

const router = Router();

const BASES = [
  '/products-locations',
  '/productsLocations',
  '/products/locations',
];

// registra em todos aliases
for (const BASE of BASES) {
  router.get(BASE, list);

  // ✅ rota que o frontend usa para carregar o select por SKU
  router.get(`${BASE}/by-product/:product_code`, listByProduct);

  router.get(`${BASE}/:id`, getById);
  router.post(BASE, create);
  router.put(`${BASE}/:id`, update);
  router.patch(`${BASE}/:id/deactivate`, deactivate);
  router.delete(`${BASE}/:id`, remove);
}

router.get('/__ping_products_locations', (req, res) => res.json({ ok: true }));

export default router;
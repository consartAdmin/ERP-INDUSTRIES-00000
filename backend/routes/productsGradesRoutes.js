// ╔══════════════════════════════════════════════════════════════════╗
// ║ productsGradesRoutes.js — Routes                                ║
// ║ CONSART ERP                                                     ║
// ║ ✅ Support by-sku                                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as ctrl from '../controllers/productsGradesController.js';

const router = Router();

/* ──────────────────────────────────────────────────────────────
   KEBAB CASE
────────────────────────────────────────────────────────────── */

router.get(
  '/api/products-grades',
  ctrl.list
);

router.get(
  '/api/products-grades/by-product/:id',
  ctrl.listByProductParam
);

router.get(
  '/api/products-grades/by-sku/:product_code',
  ctrl.getBySku
);

router.post(
  '/api/products-grades',
  ctrl.create
);

router.put(
  '/api/products-grades/:id',
  ctrl.update
);

router.delete(
  '/api/products-grades/:id',
  ctrl.remove
);

/* ──────────────────────────────────────────────────────────────
   CAMEL CASE
────────────────────────────────────────────────────────────── */

router.get(
  '/api/productsGrades',
  ctrl.list
);

router.get(
  '/api/productsGrades/by-product/:id',
  ctrl.listByProductParam
);

router.get(
  '/api/productsGrades/by-sku/:product_code',
  ctrl.getBySku
);

router.post(
  '/api/productsGrades',
  ctrl.create
);

router.put(
  '/api/productsGrades/:id',
  ctrl.update
);

router.delete(
  '/api/productsGrades/:id',
  ctrl.remove
);

export default router;
// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsUnitsRoutes.js — Rotas REST (CONSART ERP | ESM)              ║
// ║ Mount no server.js: app.use('/api', productsUnitsRoutes)             ║
// ║                                                                      ║
// ║ ✅ FIX IMPORTANTE: rotas fixas (/factors, /by-barcode)                ║
// ║    DEVEM vir ANTES de "/:id"                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import {
  ensure,
  list,
  getById,
  create,
  upsert,
  update,
  deactivate,
  remove,
  getFactorsBySkus,
  getByBarcode,
} from '../controllers/productsUnitsController.js';

const router = Router();

/* --------------------------------------------------------------------- */
/* Healthcheck / debug                                                   */
/* --------------------------------------------------------------------- */
router.get('/__ping_products_units', (_req, res) => res.json({ ok: true }));

/* --------------------------------------------------------------------- */
/* Helpers: aliases to avoid 404                                         */
/* --------------------------------------------------------------------- */
const aliases = (paths, method, handler) => {
  const m = String(method || '').toLowerCase();
  if (typeof router[m] !== 'function') {
    throw new Error(`[productsUnitsRoutes] Invalid method "${method}" in aliases()`);
  }
  for (const p of paths) router[m](p, handler);
};

const BASES = Object.freeze({
  PLURAL: '/products-units',
  SINGULAR: '/product-units',
  LEGACY: '/productsUnits',
});

/* --------------------------------------------------------------------- */
/* Ensure / list                                                         */
/* --------------------------------------------------------------------- */
aliases(
  [`${BASES.PLURAL}/ensure`, `${BASES.SINGULAR}/ensure`, `${BASES.LEGACY}/ensure`],
  'get',
  ensure
);

aliases(
  [`${BASES.PLURAL}`, `${BASES.SINGULAR}`, `${BASES.LEGACY}`],
  'get',
  list
);

/* --------------------------------------------------------------------- */
/* ✅ EXTRAS — SEMPRE ANTES DE "/:id"                                     */
/* --------------------------------------------------------------------- */

// ✅ fatores por SKU (modal rentabilidade)
aliases(
  [
    `${BASES.SINGULAR}/factors`,
    `${BASES.PLURAL}/factors`,
    `${BASES.LEGACY}/factors`,
  ],
  'get',
  getFactorsBySkus
);

// ✅ barcode lookup
aliases(
  [
    `${BASES.SINGULAR}/by-barcode`,
    `${BASES.PLURAL}/by-barcode`,
    `${BASES.LEGACY}/by-barcode`,
  ],
  'get',
  getByBarcode
);

/* --------------------------------------------------------------------- */
/* CRUD — "/:id" SEMPRE DEPOIS das fixas                                 */
/* --------------------------------------------------------------------- */
aliases(
  [`${BASES.PLURAL}/:id`, `${BASES.SINGULAR}/:id`, `${BASES.LEGACY}/:id`],
  'get',
  getById
);

aliases(
  [`${BASES.PLURAL}`, `${BASES.SINGULAR}`, `${BASES.LEGACY}`],
  'post',
  create
);

aliases(
  [`${BASES.PLURAL}/upsert`, `${BASES.SINGULAR}/upsert`, `${BASES.LEGACY}/upsert`],
  'post',
  upsert
);

aliases(
  [`${BASES.PLURAL}/:id`, `${BASES.SINGULAR}/:id`, `${BASES.LEGACY}/:id`],
  'put',
  update
);

aliases(
  [
    `${BASES.PLURAL}/:id/deactivate`,
    `${BASES.SINGULAR}/:id/deactivate`,
    `${BASES.LEGACY}/:id/deactivate`,
  ],
  'patch',
  deactivate
);

aliases(
  [`${BASES.PLURAL}/:id`, `${BASES.SINGULAR}/:id`, `${BASES.LEGACY}/:id`],
  'delete',
  remove
);

export default router;
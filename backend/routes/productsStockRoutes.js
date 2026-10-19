// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 🏬 productsStockRoutes.js — Rotas Express                              ║
// ║ Base: /api/productsStock                                                ║
// ║ CONSART ERP | ESM                                                       ║
// ║ ✅ CRUD Estoque Min./Máx.                                               ║
// ║ ✅ Busca por product_code / SKU                                         ║
// ║ ✅ Compatibilidade com /by-code                                         ║
// ║ ✅ PDF Sugestão de Compra                                               ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import ctrl from '../controllers/productsStockController.js';

const router = Router();

/* ========================================================================
   Infra
======================================================================== */

router.post('/ensure', ctrl.ensure);

/* ========================================================================
   Relatórios
======================================================================== */

router.get(
    '/purchase-suggestion/pdf',
    ctrl.purchaseSuggestionPdf,
);

/* ========================================================================
   Filtros
======================================================================== */

router.get(
    '/filter-options',
    ctrl.filterOptions,
);

/* ========================================================================
   Estoque por SKU / product_code

   Endpoint principal:
   GET /api/productsStock/by-product-code/00004941

   Compatibilidade:
   GET /api/productsStock/by-code?product_code=00004941
======================================================================== */

router.get(
    '/by-product-code/:product_code',
    ctrl.getByCode,
);

router.get(
    '/by-code',
    ctrl.getByCode,
);

/* ========================================================================
   Listagem
======================================================================== */

router.get('/', ctrl.list);

/* ========================================================================
   CRUD
======================================================================== */

router.post('/', ctrl.create);

router.get(
    '/:id(\\d+)',
    ctrl.get,
);

router.put(
    '/:id(\\d+)',
    ctrl.update,
);

router.patch(
    '/:id(\\d+)/adjust',
    ctrl.adjust,
);

router.delete(
    '/:id(\\d+)',
    ctrl.remove,
);

export default router;
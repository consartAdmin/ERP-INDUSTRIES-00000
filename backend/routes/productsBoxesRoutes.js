// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBoxesRoutes.js — Routes (ESM)                                 ║
// ║ Path: backend/routes/productsBoxesRoutes.js                           ║
// ║ API Base: /api/products-boxes                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import {
  // Boxes
  listBoxesHandler,
  listBoxesOptionsHandler,
  getBoxHandler,
  createBoxHandler,
  updateBoxHandler,
  deleteBoxHandler,

  // Items
  listBoxItemsHandler,
  upsertBoxItemHandler,
  deleteBoxItemHandler,

  // By-product (SKU)
  getBoxByProductCodeHandler,
  listBoxesByProductCodeHandler,

  // PDFs
  downloadBoxPdfHandler,
  downloadBoxesListPdfHandler,
} from '../controllers/productsBoxesController.js';

const router = Router();

/* ──────────────────────────────────────────────────────────────
   PDF (⚠️ antes de /:box_id)
────────────────────────────────────────────────────────────── */
router.get('/pdf', downloadBoxesListPdfHandler);
router.get('/:box_id/pdf', downloadBoxPdfHandler);

/* ──────────────────────────────────────────────────────────────
   OPTIONS (para preencher SELECT)
   GET /api/products-boxes/options?active=true
────────────────────────────────────────────────────────────── */
router.get('/options', listBoxesOptionsHandler);

/* ──────────────────────────────────────────────────────────────
   BY PRODUCT (SKU)
   - principal: GET /by-product/:product_code
   - lista:     GET /by-product/:product_code/list
────────────────────────────────────────────────────────────── */
router.get('/by-product/:product_code', getBoxByProductCodeHandler);
router.get('/by-product/:product_code/list', listBoxesByProductCodeHandler);

/* ──────────────────────────────────────────────────────────────
   BOXES (CRUD)
────────────────────────────────────────────────────────────── */
router.get('/', listBoxesHandler);
router.get('/:box_id', getBoxHandler);
router.post('/', createBoxHandler);
router.put('/:box_id', updateBoxHandler);
router.delete('/:box_id', deleteBoxHandler);

/* ──────────────────────────────────────────────────────────────
   ITENS (SKUs) NO BOX
────────────────────────────────────────────────────────────── */
router.get('/:box_id/items', listBoxItemsHandler);
router.post('/:box_id/items', upsertBoxItemHandler);
router.delete('/:box_id/items/:sku', deleteBoxItemHandler);

export default router;

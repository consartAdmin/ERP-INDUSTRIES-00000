// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productBarCodeSecondRoutes.js — Rotas REST (CONSART ERP | ESM)      ║
// ║ Base: /api/product-barcode-second                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';
import {
  ensureTable,
  listSecondBarCodes,
  getSecondBarCodeById,
  getBySecondBarCode,
  createSecondBarCode,
  upsertSecondBarCode,
  updateSecondBarCode,
  deleteSecondBarCode,
} from '../controllers/productBarCodeSecondController.js';

const router = express.Router();

// Opcional: rota de diagnóstico/criação de tabela
router.post('/ensure-table', ensureTable);

// GET /api/product-barcode-second
router.get('/', listSecondBarCodes);

// GET /api/product-barcode-second/by-code/:secondBarCode
router.get('/by-code/:secondBarCode', getBySecondBarCode);

// GET /api/product-barcode-second/:id
router.get('/:id', getSecondBarCodeById);

// POST /api/product-barcode-second
router.post('/', createSecondBarCode);

// PUT /api/product-barcode-second/upsert
router.put('/upsert', upsertSecondBarCode);

// PATCH /api/product-barcode-second/:id
router.patch('/:id', updateSecondBarCode);

// DELETE /api/product-barcode-second/:id
router.delete('/:id', deleteSecondBarCode);

export default router;

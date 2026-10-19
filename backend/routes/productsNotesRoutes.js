// ╔══════════════════════════════════════════════════════════════╗
// ║ FILE: backend/routes/productsNotesRoutes.js                 ║
// ║ MODULE: Products Notes Routes                               ║
// ║ CONSART ERP | ESM                                           ║
// ║ BASE: /api/products-notes                                   ║
// ╚══════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import {
  listProductNotes,
  getProductNoteById,
  createProductNote,
  updateProductNote,
  deleteProductNote,
} from '../controllers/productsNotesController.js';

const router = Router();

router.get('/product/:productCode', listProductNotes);

router.get('/:id', getProductNoteById);

router.post('/', createProductNote);

router.put('/:id', updateProductNote);

router.delete('/:id', deleteProductNote);

export default router;
// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: manufacturesOrdersRoutes.js                                   ║
// ║ MODULE: Manufactures Orders                                         ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import {
  list,
  getById,
  create,
  update,
  addItem,
  updateItem,
  removeItem,
  remove,
  generatePdf,
  generateExcel,
  generateExcelById,
  generateManufacturerPdf,
} from '../controllers/manufacturesOrdersController.js';

const router = Router();

router.get('/', list);

/* EXPORTS — antes do /:id */
router.get('/excel', generateExcel);

router.get('/:id/excel', generateExcelById);

router.get('/:id/pdf-manufacturer', generateManufacturerPdf);

/* PDF — precisa vir ANTES do /:id */
router.get('/:id/pdf', generatePdf);

router.get('/:id', getById);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

router.post('/:id/items', addItem);
router.put('/items/:itemId', updateItem);
router.delete('/items/:itemId', removeItem);

export default router;
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ pricesRoutes.js — Routes: Price Tables (CONSART ERP | ESM)               ║
// ║ Base: /api                                                               ║
// ║ - GET /api/prices                  -> dropdown (select)                  ║
// ║ - CRUD completo em /api/price-tables                                     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  dropdown,
  listFull,
  getOne,
  createOne,
  updateOne,
  removeOne,
  permanentRemoveOne,
  restoreOne,
} from '../controllers/pricesController.js';

const router = Router();

// ✅ Para o seu SELECT (sallesCommissionsFromBudgets.js chama /api/prices)
router.get('/prices', dropdown);

router.get('/price-tables', listFull);
router.get('/price-tables/:id', getOne);
router.post('/price-tables', createOne);
router.put('/price-tables/:id', updateOne);

// Inativação lógica
router.delete('/price-tables/:id', removeOne);

// Exclusão definitiva
router.delete('/price-tables/:id/permanent', permanentRemoveOne);

// Restauração
router.post('/price-tables/:id/restore', restoreOne);

export default router;

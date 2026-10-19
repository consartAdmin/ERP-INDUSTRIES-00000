//╔════════════════════════════════════════════════════════════════════════════╗
//║ 🔑 productsKeyRoutes.js — Routes: ProductsKey (CONSART ERP | ESM)         ║
//║ Base: /api/products-key                                                   ║
//╚════════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  ensure,
  list,
  getById,
  upsert,
  remove,
  resolve,
  normalize,
} from '../controllers/productsKeyController.js';

const router = Router();

// Infra
router.post('/ensure', ensure);

// Utils
router.post('/normalize', normalize);
router.post('/resolve', resolve);

// CRUD
router.get('/', list);
router.get('/:id', getById);
router.post('/', upsert);
router.delete('/:id', remove);

export default router;

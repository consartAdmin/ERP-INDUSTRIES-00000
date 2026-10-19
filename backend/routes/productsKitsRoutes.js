// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsKitsRoutes.js                                         ║
// ║ MODULE: Products Kits Routes                                        ║
// ║ BASE: /api/products-kits                                            ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import {
  ensure,
  list,
  getById,
  create,
  update,
  remove,
  destroy,
} from '../controllers/productsKitsController.js';

const router = Router();

router.post('/ensure', ensure);

router.get('/', list);
router.get('/:id', getById);

router.post('/', create);
router.put('/:id', update);

router.patch('/:id/deactivate', remove);
router.delete('/:id', destroy);

export default router;
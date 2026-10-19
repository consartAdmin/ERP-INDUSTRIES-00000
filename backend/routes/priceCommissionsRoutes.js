// ╔══════════════════════════════════════════════════════════════════════╗
// ║ priceCommissionsRoutes.js — Routes | CONSART ERP (ESM)               ║
// ║ Base: app.use('/api/price-commissions', router)                      ║
// ║ Path: /backend/routes/priceCommissionsRoutes.js                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  initPriceCommissionsController,
  listPriceCommissions,
  getPriceCommissionById,
  createPriceCommission,
  updatePriceCommission,
  deletePriceCommission,
  listPrices,
  listSellers,
} from '../controllers/priceCommissionsController.js';

const router = Router();

await initPriceCommissionsController?.();

// combos
router.get('/prices', listPrices);
router.get('/sellers', listSellers);

// crud
router.get('/', listPriceCommissions);
router.get('/:id', getPriceCommissionById);
router.post('/', createPriceCommission);
router.put('/:id', updatePriceCommission);
router.delete('/:id', deletePriceCommission);

export default router;

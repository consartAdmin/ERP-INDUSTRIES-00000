// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/routes/promoImagesRoutes.js                           ║
// ║ MODULE: Promo Images Routes                                         ║
// ║ BASE: /api/promo-images                                             ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import promoImagesController from '../controllers/promoImagesController.js';

const router = Router();

router.post('/preview', promoImagesController.preview);

router.get('/price-tables', promoImagesController.listPriceTables);

router.get('/products', promoImagesController.searchProducts);

router.post('/generate', promoImagesController.generate);

export default router;
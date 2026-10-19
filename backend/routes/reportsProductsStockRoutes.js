// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: reportsProductsStockRoutes.js                                ║
// ║ MODULE: Relatório Posição de Estoque                                ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import {
  exportExcel,
  getStockPosition,
} from '../controllers/reportsProductsStockController.js';

const router = Router();

router.get('/products-stock/position', getStockPosition);
router.get('/products-stock/excel', exportExcel);

export default router;
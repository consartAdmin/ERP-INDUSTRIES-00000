// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 🚏 batchProductsPricesRoutes.js — Batch Prices Routes (CONSART | ESM)   ║
// ║                                                                          ║
// ║  Base path (server.js): /api                                             ║
// ║                                                                          ║
// ║  POST /api/products-prices/batch/upsert    → upsertBatchPrices           ║
// ║  POST /api/products-prices/batch/adjust    → adjustBatchByPriceTable     ║
// ║                                                                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import BatchProductsPricesController, {
  upsertBatchPrices,
  adjustBatchByPriceTable,
} from '../controllers/batchProductsPricesController.js';

const router = Router();

/* ──────────────────────────────────────────────────────────────────────────
   Batch Upsert (lista livre de produtos x tabelas)
   ------------------------------------------------------------------------- */
/**
 * Exemplo:
 *  POST /api/products-prices/batch/upsert
 *  {
 *    "items": [
 *      { "product_id": "SKU001", "price_id": 1, "sale_price": 49.9 },
 *      { "product_id": "SKU002", "price_id": 1, "sale_price": 39.9 }
 *    ]
 *  }
 */
router.post(
  '/products-prices/batch/upsert',
  upsertBatchPrices /* BatchProductsPricesController.upsertBatchPrices */
);

/* ──────────────────────────────────────────────────────────────────────────
   Batch Adjust (reajuste geral por tabela de preço)
   ------------------------------------------------------------------------- */
/**
 * Exemplo reajuste +10% na tabela 1 (todos os produtos):
 *  POST /api/products-prices/batch/adjust
 *  {
 *    "price_id": 1,
 *    "mode": "percent",
 *    "operation": "increase",
 *    "value": 10
 *  }
 *
 * Exemplo -5% apenas em 2 SKUs:
 *  {
 *    "price_id": 1,
 *    "mode": "percent",
 *    "operation": "decrease",
 *    "value": 5,
 *    "product_ids": ["SKU001", "SKU002"]
 *  }
 */
router.post(
  '/products-prices/batch/adjust',
  adjustBatchByPriceTable /* BatchProductsPricesController.adjustBatchByPriceTable */
);

export default router;

/* ──────────────────────────────────────────────────────────────────────────
   Integração no server.js (exemplo)
   ------------------------------------------------------------------------- */
// import batchProductsPricesRoutes from './routes/batchProductsPricesRoutes.js';
// app.use('/api', batchProductsPricesRoutes);

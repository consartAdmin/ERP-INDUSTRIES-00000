// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 🚏 productsPrices.routes.js — Routes (CONSART ERP | ESM)                  ║
// ║ Base path: /api                                                          ║
// ║                                                                          ║
// ║  GET    /api/products/:productId/prices            → listByProduct       ║
// ║  POST   /api/products/:productId/prices            → upsertBulk          ║
// ║  PUT    /api/products/:productId/prices/:priceId   → updateOne           ║
// ║  DELETE /api/products/:productId/prices/:priceId   → removeOne           ║
// ║                                                                          ║
// ║  (Opcional: aliases PT-BR no final do arquivo)                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import {
   listByProduct,
   upsertBulk,
   updateOne,
   removeOne,
} from '../controllers/productsPrices.Controller.js';

const router = Router();

/* ──────────────────────────────────────────────────────────────────────────
   REST
   ------------------------------------------------------------------------- */

// List prices for a product
router.get('/products/:productId/prices', listByProduct /* ProductsPricesController.listByProduct */);

// Bulk upsert prices for a product
router.post('/products/:productId/prices', upsertBulk /* ProductsPricesController.upsertBulk */);

// Update a single price row (by composite key)
router.put('/products/:productId/prices/:priceId', updateOne /* ProductsPricesController.updateOne */);

// Delete a single price row (by composite key)
router.delete('/products/:productId/prices/:priceId', removeOne /* ProductsPricesController.removeOne */);

/* ──────────────────────────────────────────────────────────────────────────
   Optional aliases (PT-BR) — ative se precisar de compatibilidade:
   ------------------------------------------------------------------------- */
// import { listByProduct as listar, upsertBulk as salvarLote } from '../controllers/productsPricesController.js';
// router.get('/precos-produtos/:productId', listar);
// router.post('/precos-produtos', (req, res, next) => {
//   // Aceita body: { produto_id, precos: [...] }  → adapta e delega ao upsertBulk
//   try {
//     const produto_id = req.body?.produto_id;
//     if (!produto_id) return res.status(400).json({ ok:false, error:'produto_id é obrigatório.' });
//     // Reencaminha ajustando a rota interna
//     req.params.productId = String(produto_id);
//     return salvarLote(req, res, next);
//   } catch (e) {
//     return res.status(500).json({ ok:false, error:'Falha no alias /precos-produtos' });
//   }
// });

export default router;

/* ──────────────────────────────────────────────────────────────────────────
   server.js (exemplo)
   ------------------------------------------------------------------------- */
// import productsPricesRoutes from './routes/productsPricesRoutes.js';
// app.use('/api', productsPricesRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalRoutes.js — Rotas Express (ESM)                            ║
// ║ Base: /api                                                               ║
// ║   /productsFiscal ...  (CRUD + current + preview + import + ensure)      ║
// ║   /products/fiscal ... (batch-list + batch-link + unlink)                ║
// ║ ✅ Unificado — não existe mais controller/routes separados do batch       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as ctl from '../controllers/productsFiscalController.js';

const router = Router();

/* ──────────────────────────────────────────────────────────────────────────
   BATCH — /api/products/fiscal
   (mantém exatamente as URLs que sua tela Tab Fiscal / Lote já usa)
────────────────────────────────────────────────────────────────────────── */
router.get('/products/fiscal/batch-list', ctl.listProductsFiscalBatch);
router.post('/products/fiscal/batch-link', ctl.batchLinkProductsFiscal);
router.post('/products/fiscal/unlink', ctl.unlinkProductFiscal);

/* ──────────────────────────────────────────────────────────────────────────
   REST — /api/productsFiscal
   (ordem corrigida: rotas específicas antes de "/:id")
────────────────────────────────────────────────────────────────────────── */

// preview
router.get('/productsFiscal/preview-merge', ctl.previewMerge);

// current
router.get('/productsFiscal/current', ctl.getCurrent);
router.get('/productsFiscal/current/:productId', ctl.getCurrentByProduct);

// close current
router.post('/productsFiscal/current/:productId/close', ctl.closeCurrentByProduct);

// ensure
router.post('/productsFiscal/ensure', ctl.ensure);

// import-from-refs
router.post('/productsFiscal/:productId/import-from-refs', ctl.importFromRefs);

// CRUD
router.get('/productsFiscal', ctl.list);
router.post('/productsFiscal', ctl.createFromImport);

router.get('/productsFiscal/:id', ctl.getById);
router.put('/productsFiscal/:id', ctl.update);
router.delete('/productsFiscal/:id', ctl.softDelete);

export default router;

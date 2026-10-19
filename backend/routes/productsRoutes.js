// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ 🛣️ productsRoutes.js — Rotas de Products (CONSART ERP | ESM)             ║
// ║ Base path: /api/products                                                  ║
// ║                                                                           ║
// ║ Relatórios:                                                               ║
// ║   GET    /stock-position              → stockPositionList (JSON)          ║
// ║   GET    /stock-position/pdf          → stockPositionPdf                  ║
// ║   GET    /stock-position/excel        → stockPositionExcel                ║
// ║                                                                           ║
// ║ Opções de filtros:                                                        ║
// ║   GET    /products-groups             → listGroupOptions                  ║
// ║   GET    /products-subgroups          → listSubgroupOptions (?group_id=)  ║
// ║   GET    /products-manufactures       → listManufacturerOptions           ║
// ║   GET    /products-suppliers          → listSupplierOptions               ║
// ║                                                                           ║
// ║ Coleção:                                                                  ║
// ║   GET    /                            → list (paginação + filtros)        ║
// ║   POST   /                            → create                            ║
// ║   GET    /search                      → search (somente ativos)           ║
// ║   GET    /export                      → exportExcel                       ║
// ║   GET    /cost-map                    → getCostMap                        ║
// ║   GET    /costs                       → alias legado para getCostMap      ║
// ║   PUT    /by-code/:product_code       → updateBarcode                     ║
// ║                                                                           ║
// ║ Produto (:product_code):                                                  ║
// ║   GET    /:product_code/units         → listUnits                         ║
// ║   GET    /:product_code/registros     → getProductMovements               ║
// ║   PUT    /:product_code/restore       → restore (reativar)                ║
// ║   POST   /:product_code/imagem        → uploadImage (GCS)                 ║
// ║   GET    /:product_code               → getById                           ║
// ║   PUT    /:product_code               → update                            ║
// ║   DELETE /:product_code               → remove (soft delete)              ║
// ║                                                                           ║
// ║ Rotas fixas SEMPRE antes das dinâmicas (/:product_code).                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import multer from 'multer';

import {
  list,
  search,
  getById,
  create,
  update,
  updateBarcode,
  remove,
  restore,
  getCostMap,
  listUnits,
  getProductMovements,
  listGroupOptions,
  listSubgroupOptions,
  listManufacturerOptions,
  listSupplierOptions,
  uploadImage,
  exportExcel,
  stockPositionList,
  stockPositionPdf,
  stockPositionExcel,
} from '../controllers/productsController.js';

const router = Router();

/* ──────────────────────────────────────────────────────────────
   📦 Upload de imagem (GCS)
   - Memória (até 8MB)
   - Aceita campo "foto" (legado) OU "file" (novo)
   - Normaliza para req.file
   ────────────────────────────────────────────────────────────── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

function normalizeUpload(req, _res, next) {
  if (req.file) return next();

  if (Array.isArray(req.files) && req.files.length) {
    req.file = req.files[0];
    return next();
  }

  if (req.files && typeof req.files === 'object') {
    const [first] = Object.values(req.files);
    if (Array.isArray(first) && first.length) req.file = first[0];
  }

  return next();
}

/* ──────────────────────────────────────────────────────────────
   📊 Relatórios — Posição de Estoque
   ────────────────────────────────────────────────────────────── */
router.get('/stock-position', stockPositionList);
router.get('/stock-position/pdf', stockPositionPdf);
router.get('/stock-position/excel', stockPositionExcel);

/* ──────────────────────────────────────────────────────────────
   🔽 Opções de filtros
   ────────────────────────────────────────────────────────────── */
router.get('/products-groups', listGroupOptions);
router.get('/products-subgroups', listSubgroupOptions);
router.get('/products-manufactures', listManufacturerOptions);
router.get('/products-suppliers', listSupplierOptions);

/* ──────────────────────────────────────────────────────────────
   📄 Coleção (rotas fixas)
   ────────────────────────────────────────────────────────────── */
router.get('/', list);
router.post('/', create);

router.get('/search', search);
router.get('/export', exportExcel);

// Mapa de custos (modal Rentabilidade) + alias legado
router.get('/cost-map', getCostMap);
router.get('/costs', getCostMap);

// Atualiza somente o barcode pelo SKU
router.put('/by-code/:product_code', updateBarcode);

/* ──────────────────────────────────────────────────────────────
   🔎 Produto por SKU / product_code (rotas dinâmicas)
   ────────────────────────────────────────────────────────────── */
router.get('/:product_code/units', listUnits);
router.get('/:product_code/registros', getProductMovements);
router.put('/:product_code/restore', restore);
router.post('/:product_code/imagem', upload.any(), normalizeUpload, uploadImage);

router.get('/:product_code', getById);
router.put('/:product_code', update);
router.delete('/:product_code', remove);

export default router;

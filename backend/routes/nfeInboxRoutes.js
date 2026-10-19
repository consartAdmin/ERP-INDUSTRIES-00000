// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInboxRoutes.js — Rotas Caixa de Entrada NF-e                     ║
// ║ CONSART ERP | ESM                                                   ║
// ║                                                                     ║
// ║ Ordenação (sort/order) chega como query string em GET /api/nfe-inbox║
// ║ e em /xml-lote, então nenhuma rota nova é necessária.               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import multer from 'multer';

import {
  listNfeInbox,
  downloadNfeXmlLote,
  getNfeInboxSyncStatus,
  getNfeInboxById,
  downloadNfeXml,
  downloadNfePdf,
  manifestNfe,
  importNfeXml,
  syncNfeInboxFromDfe,
} from '../controllers/nfeInboxController.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 100 },
});

// LIST
// Query: cnpjEmpresa, situacao, manifestacao, dataIni, dataFim, q,
//        sort, order, limit, offset
router.get('/api/nfe-inbox', listNfeInbox);

// ✅✅✅ ROTAS FIXAS ANTES DO /:id
router.get('/api/nfe-inbox/xml-lote', downloadNfeXmlLote);
router.get('/api/nfe-inbox/sync-status', getNfeInboxSyncStatus);

// por ID
router.get('/api/nfe-inbox/:id', getNfeInboxById);

// XML e PDF por ID
router.get('/api/nfe-inbox/:id/xml', downloadNfeXml);
router.get('/api/nfe-inbox/:id/pdf', downloadNfePdf);

// Manifestação
router.post('/api/nfe-inbox/:id/manifest', manifestNfe);

// Upload manual
router.post('/api/nfe-inbox/import-xml', upload.array('files'), importNfeXml);

// Sync DF-e
router.post('/api/nfe-inbox/sync-dfe', syncNfeInboxFromDfe);

export default router;
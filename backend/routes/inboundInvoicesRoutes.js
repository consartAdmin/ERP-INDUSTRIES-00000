// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inboundInvoicesRoutes.js — Rotas Notas de Entrada (Inbound NF-e)   ║
// ║ CONSART ERP | ESM                                                  ║
// ║ ✅ IDs semânticos: inboundId, inboundItemId e inboundInstallmentId ║
// ║ ✅ Monitoramento automático de erros por e-mail                   ║
// ║ ✅ Diagnóstico explícito do POST /import-xml                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import { ensureInboundRawSupport } from '../repositories/pcp/pcpInbound.repository.js';
import multer from 'multer';

import { queueErrorEmail } from '../errorEmailReporter.js';

import {
  importXmlInvoiceCtrl,
  autoImportFromDfeCtrl,
  listInvoicesCtrl,
  getInvoiceCtrl,
  createInvoiceCtrl,
  updateInvoiceCtrl,
  deleteInvoiceCtrl,
  postInvoiceCtrl,
  listInstallmentsCtrl,
  createInstallmentCtrl,
  updateInstallmentCtrl,
  deleteInstallmentCtrl,
  listItemsCtrl,
  createItemCtrl,
  updateItemCtrl,
  deleteItemCtrl,
} from '../controllers/inboundInvoicesController.js';

const router = Router();

// Prodnex PCP: garante (uma vez) a coluna raw_material_id dos itens e as tabelas de
// matérias-primas antes de qualquer transação das notas de entrada.
router.use(async (_req, _res, next) => {
  try {
    await ensureInboundRawSupport();
  } catch (err) {
    console.error('[PCP][INBOUND] ensureInboundRawSupport:', err?.message);
  }
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
});

function reportInboundRouteError(err, req) {
  console.error('[INBOUND][ROUTES][ERROR]', err);

  return queueErrorEmail('INBOUND_ROUTES_ERROR', {
    module: 'routes/inboundInvoicesRoutes.js',
    status: Number(err?.status || err?.statusCode || 500),
    request: {
      method: req?.method,
      path: req?.originalUrl || req?.url,
      requestId: req?.id,
    },
    err: {
      name: err?.name,
      message: err?.message || String(err),
      code: err?.code,
      stack: err?.stack,
    },
  });
}

// Prévia do XML por upload.
router.post(
  '/import-xml',
  (req, _res, next) => {
    console.log('[INBOUND][ROUTES][IMPORT_XML_HIT]', {
      method: req.method,
      originalUrl: req.originalUrl || req.url,
      contentType: req.headers?.['content-type'] || null,
      ts: new Date().toISOString(),
    });
    next();
  },
  upload.single('xml'),
  (req, _res, next) => {
    console.log('[INBOUND][ROUTES][IMPORT_XML_FILE]', {
      hasFile: Boolean(req.file),
      fieldname: req.file?.fieldname || null,
      originalname: req.file?.originalname || null,
      mimetype: req.file?.mimetype || null,
      size: req.file?.size || 0,
    });
    next();
  },
  importXmlInvoiceCtrl
);

// Importação automática por accessKey, xmlContent ou XML salvo em disco.
router.post('/auto-from-dfe', autoImportFromDfeCtrl);

// NF-e de entrada.
router.get('/', listInvoicesCtrl);
router.post('/', createInvoiceCtrl);
router.get('/:inboundId', getInvoiceCtrl);
router.put('/:inboundId', updateInvoiceCtrl);
router.delete('/:inboundId', deleteInvoiceCtrl);
router.post('/:inboundId/post', postInvoiceCtrl);

// Parcelas da NF-e de entrada.
router.get('/:inboundId/installments', listInstallmentsCtrl);
router.post('/:inboundId/installments', createInstallmentCtrl);
router.put('/installments/:inboundInstallmentId', updateInstallmentCtrl);
router.delete('/installments/:inboundInstallmentId', deleteInstallmentCtrl);

// Itens da NF-e de entrada.
router.get('/:inboundId/items', listItemsCtrl);
router.post('/:inboundId/items', createItemCtrl);
router.put('/items/:inboundItemId', updateItemCtrl);
router.delete('/items/:inboundItemId', deleteItemCtrl);

// Erros dos middlewares da rota, inclusive Multer/upload do XML.
router.use((err, req, _res, next) => {
  void reportInboundRouteError(err, req);
  next(err);
});

export default router;

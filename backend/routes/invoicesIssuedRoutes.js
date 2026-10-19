// ╔══════════════════════════════════════════════════════════════════════╗
// ║ invoicesIssuedRoutes.js — Rotas de Notas Fiscais Emitidas          ║
// ║ CONSART ERP | ESM | /api/invoices-issued                           ║
// ║ ✅ CRUD completo                                                    ║
// ║ ✅ Downloads XML/DANFE                                              ║
// ║ ✅ Download XML + DANFE + todos os boletos                          ║
// ║ ✅ Sincronização com pedidos faturados                              ║
// ║ ✅ Finalização/reconciliação de NF-e por pedido                     ║
// ║ ✅ Envio NF-e + DANFE + boleto por e-mail                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';

import {
  createInvoiceIssued,
  searchInvoicesIssued,
  getInvoiceIssuedById,
  getInvoicesByOrderId,
  updateInvoiceIssued,
  cancelInvoiceIssued,
  deleteInvoiceIssued,
  syncInvoiceFromOrder,
  syncAllFaturadasFromOrders,
  finishInvoiceFromOrder,
  downloadInvoiceXml,
  downloadInvoiceDanfe,
  downloadInvoicesXmlZip,
  downloadInvoicesDanfeZip,
  getInvoicesIssuedKpis,
} from '../controllers/invoicesIssuedController.js';

import {
  sendInvoiceIssuedEmail,
  downloadInvoiceIssuedDocuments,
} from '../controllers/invoicesIssuedEmailController.js';

const router = express.Router();

// ======================================================================
// LISTAGEM / BUSCA
// ======================================================================

router.get('/', searchInvoicesIssued);

router.get('/search', searchInvoicesIssued);

// KPIs GLOBAIS

router.get('/kpis', getInvoicesIssuedKpis);

// ======================================================================
// SINCRONIZAÇÃO / RECONCILIAÇÃO
// Rotas fixas sempre antes de /:id
// ======================================================================

router.post('/sync-faturadas', syncAllFaturadasFromOrders);

router.post(
  '/sync-from-order/:orderId(\\d+)',
  syncInvoiceFromOrder
);

router.post(
  '/finish-from-order/:orderId(\\d+)',
  finishInvoiceFromOrder
);

// ======================================================================
// DOWNLOADS EM LOTE
// Sempre antes de /:id
// ======================================================================

router.get(
  '/downloads/xmls',
  downloadInvoicesXmlZip
);

router.get(
  '/downloads/danfes',
  downloadInvoicesDanfeZip
);

// ======================================================================
// CRIAÇÃO MANUAL
// ======================================================================

router.post(
  '/',
  createInvoiceIssued
);

// ======================================================================
// CONSULTAS ESPECÍFICAS
// Sempre antes de /:id
// ======================================================================

router.get(
  '/order/:orderId(\\d+)',
  getInvoicesByOrderId
);

// ======================================================================
// ENVIO POR E-MAIL
// ======================================================================

router.post(
  '/:id(\\d+)/send-email',
  sendInvoiceIssuedEmail
);

// ======================================================================
// DOWNLOADS INDIVIDUAIS
// ======================================================================

router.get(
  '/:id(\\d+)/xml',
  downloadInvoiceXml
);

router.get(
  '/:id(\\d+)/danfe',
  downloadInvoiceDanfe
);

router.get(
  '/:id(\\d+)/download-all',
  downloadInvoiceIssuedDocuments
);

// ======================================================================
// CRUD POR ID
// Estas rotas ficam por último para evitar colisões
// ======================================================================

router.get(
  '/:id(\\d+)',
  getInvoiceIssuedById
);

router.put(
  '/:id(\\d+)',
  updateInvoiceIssued
);

router.patch(
  '/:id(\\d+)',
  updateInvoiceIssued
);

router.post(
  '/:id(\\d+)/cancel',
  cancelInvoiceIssued
);

router.delete(
  '/:id(\\d+)',
  deleteInvoiceIssued
);

export default router;
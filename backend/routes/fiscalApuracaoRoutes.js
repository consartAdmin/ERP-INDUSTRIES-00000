// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalApuracaoRoutes.js                                        ║
// ║ MODULE: FISCAL APURACAO                                              ║
// ║ CONSART ERP                                                          ║
// ║ ROUTES LAYER                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';

import {
  createApuracao,
  listApuracoes,
  getApuracaoById,
  rebuildApuracaoSummary,
  closeApuracao,
  reopenApuracao,
  deleteApuracao,
  importXmlToApuracao,
  fiscalApuracaoUpload,
  exportApuracaoPdf,
  exportApuracaoExcel
} from '../controllers/fiscalApuracaoController.js';

const router = express.Router();

/* ======================================================================
   CREATE
   ====================================================================== */
router.post('/fiscal-apuracao', createApuracao);

/* ======================================================================
   LIST
   ====================================================================== */
router.get('/fiscal-apuracao', listApuracoes);

/* ======================================================================
   GET BY ID
   ====================================================================== */
router.get('/fiscal-apuracao/:id', getApuracaoById);

/* ======================================================================
   IMPORT XML
   ====================================================================== */
router.post(
  '/fiscal-apuracao/:id/import-xml',
  fiscalApuracaoUpload.array('xmlFiles', 500),
  importXmlToApuracao
);

/* ======================================================================
   EXPORT PDF
====================================================================== */

router.get(
  '/fiscal-apuracao/:id/export/pdf',
  exportApuracaoPdf
);


/* ======================================================================
   EXPORT EXCEL
====================================================================== */

router.get(
  '/fiscal-apuracao/:id/export/excel',
  exportApuracaoExcel
);


/* ======================================================================
   REBUILD SUMMARY
   ====================================================================== */
router.post('/fiscal-apuracao/:id/rebuild-summary', rebuildApuracaoSummary);

/* ======================================================================
   CLOSE
   ====================================================================== */
router.patch('/fiscal-apuracao/:id/close', closeApuracao);

/* ======================================================================
   REOPEN
   ====================================================================== */
router.patch('/fiscal-apuracao/:id/reopen', reopenApuracao);

/* ======================================================================
   DELETE
   ====================================================================== */
router.delete('/fiscal-apuracao/:id', deleteApuracao);

export default router;
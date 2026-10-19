// ╔══════════════════════════════════════════════════════════════════════╗
// ║ File: backend/routes/uploadCashRoutes.js                            ║
// ║ Desc: Uploads + Attachments (Cash Movements)                        ║
// ║ CONSART ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';

import {
  uploadAnexoCaixa,
  signAnexoGcs,
  confirmAnexoGcs,
  signReadAnexo,
  diagUpload,
  listAnexosCaixa,
  countAnexosCaixa,
  deleteAnexoCaixa,
} from '../uploadBuckets/uploadBucketsCashMoviments.js';

/* =========================================================
   UPLOAD ROUTER
========================================================= */

export const uploadRouter = express.Router();

/**
 * Prefix:
 * /api/upload
 */

uploadRouter.post(
  '/anexo',
  uploadAnexoCaixa
);

uploadRouter.post(
  '/anexo/sign',
  signAnexoGcs
);

uploadRouter.post(
  '/anexo/confirm',
  confirmAnexoGcs
);

uploadRouter.get(
  '/anexo/sign-read',
  signReadAnexo
);

uploadRouter.get(
  '/diag',
  diagUpload
);

/* =========================================================
   CASH ATTACHMENTS ROUTER
========================================================= */

export const cashAttachmentsRouter = express.Router();

/**
 * Prefix:
 * /api/caixa
 */

cashAttachmentsRouter.get(
  '/movimentacoes/:id/anexos',
  listAnexosCaixa
);

cashAttachmentsRouter.get(
  '/movimentacoes/:id/anexos/count',
  countAnexosCaixa
);

cashAttachmentsRouter.delete(
  '/movimentacoes/:id/anexos/:anexoId',
  deleteAnexoCaixa
);

/* =========================================================
   EXPORTS
========================================================= */

export default {
  uploadRouter,
  cashAttachmentsRouter,
};
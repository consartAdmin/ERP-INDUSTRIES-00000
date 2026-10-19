// ╔══════════════════════════════════════════════════════════════════════╗
// ║ supplierReturnsRoutes.js — Rotas Devolução ao Fornecedor             ║
// ║ CONSART ERP                                                         ║
// ║ ✔ Importa XML NF-e de entrada                                        ║
// ║ ✔ CRUD devolução ao fornecedor                                       ║
// ║ ✔ Draft / emissão NF-e                                               ║
// ║ ✔ Sincronização PlugNotas / TecnoSpeed                               ║
// ║ ✔ Download XML e DANFE                                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';
import multer from 'multer';
import * as Controller from '../controllers/supplierReturnsController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filename = String(file.originalname || '').toLowerCase();
    const mimetype = String(file.mimetype || '').toLowerCase();

    const isXmlFile = filename.endsWith('.xml');
    const isXmlMime = ['text/xml', 'application/xml', 'text/plain'].includes(mimetype);

    if (!isXmlFile && !isXmlMime) {
      return cb(new Error('Envie um arquivo XML válido.'));
    }

    return cb(null, true);
  },
});

function multerErrorHandler(err, req, res, next) {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      ok: false,
      success: false,
      message:
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Arquivo XML excede o limite de 8MB.'
          : err.message || 'Erro no upload do XML.',
    });
  }

  return res.status(400).json({
    ok: false,
    success: false,
    message: err.message || 'Erro ao processar arquivo XML.',
  });
}

/* =========================================================
   Infra / setup
========================================================= */
router.post('/ensure', Controller.ensure);

/* =========================================================
   Importação XML NF-e de entrada
========================================================= */
router.post(
  '/import-inbound-xml',
  upload.single('xml'),
  multerErrorHandler,
  Controller.importInboundXml
);

/* =========================================================
   Lista / criação
========================================================= */
router.get('/', Controller.list);
router.post('/', Controller.create);

/* =========================================================
   NF-e devolução
   IMPORTANT: must come before /:id
========================================================= */
router.get('/:id/nfe-draft', Controller.buildNfeDraft);
router.post('/:id/emit-nfe', Controller.emitNfe);

/* =========================================================
   Sincronização PlugNotas / TecnoSpeed
   IMPORTANT: must come before /:id
========================================================= */
router.post('/:id/sync-plugnotas', Controller.syncPlugNotas);

/* =========================================================
   Download XML / DANFE
   IMPORTANT: must come before /:id
========================================================= */
router.get('/:id/xml', Controller.downloadXml);
router.get('/:id/danfe', Controller.downloadPdf);

/* =========================================================
   Registro específico
========================================================= */
router.get('/:id', Controller.getById);
router.put('/:id', Controller.update);
router.delete('/:id', Controller.remove);

export default router;
// ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailOutboundsRoutes.js — Routes E-mails Enviados (ESM)              ║
// ║ Base mount: /api/email                                              ║
// ║ Endpoints: /outbounds[...]                                          ║
// ║ ✅ multer (memoryStorage) p/ FormData + attachments[]                ║
// ║ ✅ Limites de upload + filtro opcional                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import multer from 'multer';
import emailOutboundsController from '../controllers/emailOutboundsController.js';

const router = Router();

const {
  listOutboundsHandler,
  getOutboundByIdHandler,
  clearOutboundsHandler,
  sendOutboundEmailHandler,
  importOutboundsFromHostingerHandler,
} = emailOutboundsController;

/* -------------------------------------------------------------------------- */
/* Multer (FormData: attachments[])                                           */
/* -------------------------------------------------------------------------- */

const MAX_ATTACHMENTS =
  Number.parseInt(process.env.EMAIL_MAX_ATTACHMENTS || '10', 10) || 10;

// default 15MB por arquivo (ajuste se quiser)
const MAX_FILE_SIZE =
  Number.parseInt(
    process.env.EMAIL_MAX_ATTACHMENT_BYTES || String(15 * 1024 * 1024),
    10
  );

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_ATTACHMENTS,
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    // ✅ opcional: permitir tudo
    // return cb(null, true);

    // ✅ opcional: bloqueio simples de tipos perigosos
    const name = String(file?.originalname || '').toLowerCase();
    const blockedExt = ['.exe', '.bat', '.cmd', '.js', '.msi', '.com', '.scr'];
    if (blockedExt.some((ext) => name.endsWith(ext))) {
      const err = new Error('Tipo de arquivo não permitido.');
      err.code = 'EMAIL_ATTACHMENT_BLOCKED';
      return cb(err);
    }

    return cb(null, true);
  },
});

/* --------------------------------------------------------------------- */
/* GET /api/email/outbounds — Lista últimos e-mails enviados              */
/* --------------------------------------------------------------------- */
router.get('/outbounds', listOutboundsHandler);

/* --------------------------------------------------------------------- */
/* GET /api/email/outbounds/:id — Detalhes completos                      */
/* --------------------------------------------------------------------- */
router.get('/outbounds/:id', getOutboundByIdHandler);

/* --------------------------------------------------------------------- */
/* DELETE /api/email/outbounds — Limpa tabela (debug/homolog)             */
/* --------------------------------------------------------------------- */
router.delete('/outbounds', clearOutboundsHandler);

/* --------------------------------------------------------------------- */
/* POST /api/email/outbounds — Envia novo e-mail                          */
/* FormData: attachments (campo)                                          */
/* --------------------------------------------------------------------- */
router.post(
  '/outbounds',
  upload.array('attachments', MAX_ATTACHMENTS),
  sendOutboundEmailHandler
);

/* --------------------------------------------------------------------- */
/* POST /api/email/outbounds/import-hostinger — Importa pasta "Sent"      */
/* --------------------------------------------------------------------- */
router.post('/outbounds/import-hostinger', importOutboundsFromHostingerHandler);

export default router;

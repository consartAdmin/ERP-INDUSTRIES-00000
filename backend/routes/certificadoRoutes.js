// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 🛣️ certificadoRoutes.js — Rotas Certificado Digital (ESM, pronto)       ║
/* ║  - POST /api/certificado           → upload + valida + salva (GCS|/tmp)
   ║  - GET  /api/certificado/env       → exibe config ativa p/ UI
   ║  - POST /api/certificado/apply-env → (opcional) aplica ENVs no Cloud Run
   ║                                                                          */
// ╚══════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { uploadCertificado, getEnv } from '../controllers/certificadoController.js';
import { updateCloudRunEnv } from '../services/cloudRunEnv.js';

const router = Router();

// ────────────────────────────────────────────────────────────────────────────
// Multer: memoria + filtro .pfx + limite (10MB)
// ────────────────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = file.originalname?.toLowerCase().endsWith('.pfx');
    return ok ? cb(null, true) : cb(new Error('FILETYPE_NOT_ALLOWED'));
  },
});

// 🔒 POST /api/certificado  (campo: certificado .pfx, body: { senha })
router.post('/', (req, res, next) => {
  upload.single('certificado')(req, res, (err) => {
    if (!err) return uploadCertificado(req, res);
    // Tratativas amigáveis
    if (err?.message === 'FILETYPE_NOT_ALLOWED') {
      return res.status(400).json({ erro: 'Envie um arquivo .pfx válido.' });
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ erro: 'Arquivo maior que 10MB.' });
    }
    return next(err);
  });
});

// 🔎 GET /api/certificado/env
router.get('/env', getEnv);

// ⚙️ POST /api/certificado/apply-env  (opcional)
// Requer CLOUD_RUN_REGION, CLOUD_RUN_SERVICE e permissão run.admin
router.post('/apply-env', async (req, res) => {
  try {
    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.PROJECT_ID;

    const region = process.env.CLOUD_RUN_REGION;
    const service = process.env.CLOUD_RUN_SERVICE;

    if (!projectId || !region || !service) {
      return res.status(400).json({
        erro:
          'Defina GOOGLE_CLOUD_PROJECT, CLOUD_RUN_REGION e CLOUD_RUN_SERVICE no serviço atual.',
      });
    }

    const envVars = {
      NFE_CERT_BUCKET: process.env.NFE_CERT_BUCKET || req.body?.bucket || '',
      NFE_CERT_OBJECT:
        process.env.NFE_CERT_OBJECT ||
        req.body?.object ||
        'certificadoDigital/certificado.pfx',
      NFE_CERT_GCS_URI:
        req.body?.gcsUri || process.env.NFE_CERT_GCS_URI || '',
    };

    const op = await updateCloudRunEnv({
      projectId,
      region,
      serviceName: service,
      envVars,
    });

    return res.json({
      ok: true,
      message: 'Atualização enviada. O Cloud Run criará uma nova revisão com as ENVs.',
      operation: op?.name || op,
      envVars,
    });
  } catch (e) {
    console.error('[apply-env] ERR:', e?.message || e);
    return res.status(500).json({ erro: 'Falha ao aplicar ENVs no Cloud Run.' });
  }
});

export default router;

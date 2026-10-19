// routes/testCertificadoRoutes.js (ESM)

import express from 'express';
import multer from 'multer';
import { pfxInfo, signText, signXml } from '../controllers/testCertificadoController.js';

// Multer em memória (campo do arquivo deve se chamar "pfx")
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    // aceita .pfx / .p12 (alguns browsers mandam application/x-pkcs12)
    const okTypes = new Set([
      'application/x-pkcs12',
      'application/octet-stream',
      'application/pkcs12',
    ]);
    if (okTypes.has(file.mimetype) || /\.pfx$|\.p12$/i.test(file.originalname)) {
      return cb(null, true);
    }
    // Não bloqueia aqui; o controller valida depois
    cb(null, true);
  },
});

const router = express.Router();

// POST /api/test-certificado/pfx-info
router.post('/pfx-info', upload.single('pfx'), pfxInfo);

// POST /api/test-certificado/sign-text
router.post('/sign-text', upload.single('pfx'), signText);

// POST /api/test-certificado/sign-xml
router.post('/sign-xml', upload.single('pfx'), signXml);

export default router;

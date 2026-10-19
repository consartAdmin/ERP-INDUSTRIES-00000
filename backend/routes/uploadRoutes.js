// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ 📂 uploadRoutes.js – Upload de Imagens e PDFs (Local ou GCS) – ESM        ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Storage } from '@google-cloud/storage';

const router = express.Router();

// =========================
// Config por ambiente
// =========================
const USE_GCS = (process.env.UPLOAD_DRIVER || '').toLowerCase() === 'gcs';
const MAX_SIZE = (Number(process.env.UPLOAD_MAX_MB) || 10) * 1024 * 1024; // 10MB
const IN_CLOUD_RUN = !!process.env.K_SERVICE;

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function subfolderByMime(mt = '') {
  if (mt.startsWith('image/')) return 'imagens';
  if (mt === 'application/pdf') return 'pdfs';
  return 'outros';
}
function safeName(original) {
  const base = (original || 'arquivo').replace(/[^\w.\-]+/g, '_');
  const ext  = path.extname(base) || '';
  const name = path.basename(base, ext);
  return `${name}-${Date.now()}${ext.toLowerCase()}`;
}

// =========================
// PING diagnóstico
// =========================
router.get('/ping', async (_req, res) => {
  const payload = {
    ok: true,
    route: '/api/upload',
    driver: USE_GCS ? 'gcs' : 'local',
    bucket: process.env.UPLOAD_BUCKET || null,
    now: Date.now()
  };
  if (USE_GCS) {
    try {
      const storage = new Storage();
      const [exists] = await storage.bucket(process.env.UPLOAD_BUCKET).exists();
      payload.bucketExists = exists;
    } catch (e) {
      payload.gcsError = e.message;
    }
  }
  res.json(payload);
});

// =========================
// DRIVER LOCAL (dev)
// =========================
if (!USE_GCS) {
  const BASE = IN_CLOUD_RUN
    ? '/tmp/uploads' // Cloud Run só permite escrita em /tmp
    : path.join(process.cwd(), 'public', 'uploads');

  ensureDir(BASE);

  const storage = multer.diskStorage({
    destination: (_req, file, cb) => {
      const dir = path.join(BASE, subfolderByMime(file.mimetype));
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, safeName(file.originalname))
  });

  const uploadAny = multer({ storage, limits: { fileSize: MAX_SIZE } }).any();

  router.post('/imagem', (req, res) => {
    uploadAny(req, res, (err) => {
      if (err) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ ok: false, erro: err.message || 'Falha no upload' });
      }
      const f = req.files?.find(x => ['arquivo','file','imagem'].includes(x.fieldname)) || req.files?.[0];
      if (!f) return res.status(400).json({ ok: false, erro: 'Arquivo ausente' });

      const rel = `/uploads/${subfolderByMime(f.mimetype)}/${f.filename}`;
      return res.json({ ok: true, url: rel, arquivo: { url: rel } });
    });
  });

  router.post('/pdf', (req, res) => {
    uploadAny(req, res, (err) => {
      if (err) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ ok: false, erro: err.message || 'Falha no upload' });
      }
      const f = req.files?.[0];
      if (!f) return res.status(400).json({ ok: false, erro: 'Arquivo ausente' });

      const rel = `/uploads/pdfs/${f.filename}`;
      return res.json({ ok: true, url: rel, arquivo: { url: rel } });
    });
  });

} else {
// =========================
// DRIVER GCS (prod)
// =========================
  const storage = new Storage();
  const bucketName = process.env.UPLOAD_BUCKET;
  const bucket = storage.bucket(bucketName);
  const PUBLIC_URLS = (process.env.GCS_PUBLIC || 'false').toLowerCase() === 'true';

  const uploadMem = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SIZE } }).any();

  async function saveToGCS(buf, mime, originalname) {
    const folder = subfolderByMime(mime);
    const filename = safeName(originalname);
    const objectPath = `${folder}/${filename}`;
    const file = bucket.file(objectPath);

    await file.save(buf, {
      resumable: false,
      metadata: { contentType: mime, cacheControl: 'public, max-age=31536000' }
    });

    if (PUBLIC_URLS) {
      return `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
    }

    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 5 // 5 anos
    });
    return signedUrl;
  }

  router.post('/imagem', (req, res) => {
    uploadMem(req, res, async (err) => {
      if (err) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ ok: false, erro: err.message || 'Falha no upload' });
      }
      const f = req.files?.find(x => ['arquivo','file','imagem'].includes(x.fieldname)) || req.files?.[0];
      if (!f) return res.status(400).json({ ok: false, erro: 'Arquivo ausente' });

      try {
        const url = await saveToGCS(f.buffer, f.mimetype, f.originalname);
        return res.json({ ok: true, url, arquivo: { url } });
      } catch (e) {
        console.error('[GCS][upload] erro:', e);
        return res.status(500).json({ ok: false, erro: e.message || 'Falha ao salvar no GCS' });
      }
    });
  });

  router.post('/pdf', (req, res) => {
    uploadMem(req, res, async (err) => {
      if (err) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ ok: false, erro: err.message || 'Falha no upload' });
      }
      const f = req.files?.[0];
      if (!f) return res.status(400).json({ ok: false, erro: 'Arquivo ausente' });

      try {
        const url = await saveToGCS(f.buffer, f.mimetype, f.originalname);
        return res.json({ ok: true, url, arquivo: { url } });
      } catch (e) {
        console.error('[GCS][upload][pdf] erro:', e);
        return res.status(500).json({ ok: false, erro: e.message || 'Falha ao salvar no GCS' });
      }
    });
  });
}

export default router;

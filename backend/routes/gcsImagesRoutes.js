// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ routes/gcsImagesRoutes.js — Upload + Signed URL + Proxy (Imagens Produtos) ║
// ║ CONSART ERP — ESM                                                          ║
// ║                                                                            ║
// ║ Endpoints:                                                                 ║
// ║  - POST /api/gcs/images/upload     (multipart: image, body: sku)           ║
// ║  - GET  /api/gcs/images/signed-url?key=...                                 ║
// ║  - GET  /api/gcs/images/proxy?key=...   (stream image)                     ║
// ║    (ou /proxy?url=https://storage.googleapis.com/bucket/key)               ║
// ║                                                                            ║
// ║ ✅ Compatível com services/gcs.js (seu arquivo atual)                      ║
// ║ ✅ SEM bucket dentro do key                                                ║
// ║ ✅ Aceita key/URL/gs://... e normaliza                                     ║
// ║ ✅ Prefix padrão: erp-infinity-00000/productsImagens/<SKU>/...                ║
// ╚════════════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';
import multer from 'multer';
import path from 'path';
import gcs from '../services/gcs.js';

// ✅ fallback seguro caso seu services/gcs.js não tenha stream nativo
import { Storage } from '@google-cloud/storage';

const router = express.Router();

// 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// -----------------------------------------------------------------------------
// Bucket / Prefix
// -----------------------------------------------------------------------------
const BUCKET =
  process.env.GCS_BUCKET_PRODUCTS ||
  process.env.GCS_BUCKET ||
  process.env.GOOGLE_CLOUD_BUCKET ||
  process.env.UPLOAD_BUCKET ||
  'erp-infinity-00000';

const IMAGES_BASE_PREFIX = String(
  process.env.GCS_IMAGES_PREFIX || 'productsImagens'
).replace(/^\/+|\/+$/g, '');

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function sanitizeSku(sku) {
  return String(sku || '')
    .trim()
    .replace(/[^\w.-]+/g, '');
}

function normalizeExt(originalname = '') {
  const ext = (path.extname(originalname || '').toLowerCase() || '.webp').replace(/[^.\w]/g, '');
  return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.webp';
}

/**
 * Extrai bucket/key se vier:
 * - gs://bucket/key
 * - https://storage.googleapis.com/bucket/key
 * - https://storage.cloud.google.com/bucket/key
 * Caso não seja nenhum, retorna { bucket: null, key: input }
 */
function parseBucketAndKey(input = '') {
  const raw = String(input || '').trim();
  if (!raw) return { bucket: null, key: '' };

  if (/^gs:\/\//i.test(raw)) {
    const no = raw.replace(/^gs:\/\//i, '');
    const idx = no.indexOf('/');
    if (idx === -1) return { bucket: no, key: '' };
    return { bucket: no.slice(0, idx), key: no.slice(idx + 1) };
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      const host = u.hostname || '';
      if (host === 'storage.googleapis.com' || host === 'storage.cloud.google.com') {
        const p = u.pathname.replace(/^\/+/, '');
        const parts = p.split('/');
        const bucket = parts.shift() || null;
        const key = parts.join('/');
        return { bucket, key };
      }
    } catch {
      // segue como key
    }
  }

  return { bucket: null, key: raw.replace(/^\/+/, '') };
}

function stripBucketFromKeyIfPresent(k, bucketName) {
  let key = String(k || '').replace(/^\/+/, '');
  const b = String(bucketName || '').trim();
  if (!b) return key;

  const re = new RegExp(`^${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/+`, 'i');
  key = key.replace(re, '');
  return key.replace(/^\/+/, '');
}

function ensureImagesPrefix(key = '') {
  let k = String(key || '').trim();
  if (!k) return '';

  const parsed = parseBucketAndKey(k);
  k = String(parsed.key || k).trim();

  k = stripBucketFromKeyIfPresent(k, BUCKET);
  k = k.replace(/^\/+/, '');
  if (!k) return '';

  if (k.startsWith(IMAGES_BASE_PREFIX + '/')) return k;
  if (k.startsWith('productsImagens/')) return k;

  return `${IMAGES_BASE_PREFIX}/${k}`.replace(/\/+/g, '/');
}

// -----------------------------------------------------------------------------
// Storage client (fallback)
// -----------------------------------------------------------------------------
// Se o seu ../services/gcs.js já usa credenciais, tudo bem.
// Aqui só cria um client padrão (usa ADC / env do Google).
const storage = new Storage();

// -----------------------------------------------------------------------------
// GET /api/gcs/images/signed-url?key=...
// -----------------------------------------------------------------------------
router.get('/signed-url', async (req, res) => {
  try {
    const keyIn = String(req.query.key || '').trim();
    if (!keyIn) return res.status(400).json({ ok: false, message: 'key é obrigatório' });

    const parsed = parseBucketAndKey(keyIn);
    const bucket = (parsed.bucket || BUCKET || '').trim();
    const key = ensureImagesPrefix(parsed.key || keyIn);

    if (!bucket) {
      return res.status(400).json({
        ok: false,
        message: 'Bucket não configurado (GCS_BUCKET_PRODUCTS/GCS_BUCKET/GOOGLE_CLOUD_BUCKET/UPLOAD_BUCKET).'
      });
    }
    if (!key) return res.status(400).json({ ok: false, message: 'Key inválida após normalização.' });

    const url = await gcs.getSignedURL({
      bucket,
      key,
      action: 'read',
      expiresMinutes: 30
    });

    if (!url) {
      return res.status(404).json({
        ok: false,
        url: null,
        bucket,
        key,
        message: 'Arquivo não encontrado ou GCS não configurado'
      });
    }

    return res.json({ ok: true, bucket, key, url });
  } catch (err) {
    console.error('[gcsImages] signed-url error:', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro ao assinar URL' });
  }
});

// -----------------------------------------------------------------------------
// GET /api/gcs/images/proxy?key=...   (ou ?url=...)
// Stream da imagem (same-origin), evita ORB/CORS no browser.
// -----------------------------------------------------------------------------
router.get('/proxy', async (req, res) => {
  try {
    const keyIn = String(req.query.key || '').trim();
    const urlIn = String(req.query.url || '').trim();

    if (!keyIn && !urlIn) {
      return res.status(400).send('key ou url é obrigatório');
    }

    const raw = keyIn || urlIn;
    const parsed = parseBucketAndKey(raw);

    const bucket = (parsed.bucket || BUCKET || '').trim();
    const key = ensureImagesPrefix(parsed.key || raw);

    if (!bucket) return res.status(400).send('Bucket não configurado');
    if (!key) return res.status(400).send('Key inválida após normalização');

    // 1) Tenta metadata p/ content-type
    let contentType = '';
    try {
      const [meta] = await storage.bucket(bucket).file(key).getMetadata();
      contentType = String(meta?.contentType || '');
      if (meta?.cacheControl) res.setHeader('Cache-Control', meta.cacheControl);
    } catch (e) {
      // Se não pegar metadata, segue mesmo assim (stream pode funcionar)
    }

    // 2) Headers básicos
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('X-Consart-GCS-Bucket', bucket);
    res.setHeader('X-Consart-GCS-Key', key);

    // 3) Stream do GCS
    const file = storage.bucket(bucket).file(key);
    const stream = file.createReadStream();

    stream.on('error', (err) => {
      console.error('[gcsImages] proxy stream error:', err);

      // Normaliza status
      const code = Number(err?.code) || 500;

      // Se já começou a enviar, só encerra
      if (res.headersSent) {
        try { res.end(); } catch {}
        return;
      }

      // 403/404 ficam muito úteis pro debug
      if (code === 403) {
        return res.status(403).send(`403 Forbidden ao ler GCS. Verifique permissões da service account. bucket=${bucket} key=${key}`);
      }
      if (code === 404) {
        return res.status(404).send(`404 Not Found no GCS. bucket=${bucket} key=${key}`);
      }
      return res.status(500).send(`Erro ao ler GCS (code=${code}). bucket=${bucket} key=${key}`);
    });

    stream.pipe(res);
  } catch (err) {
    console.error('[gcsImages] proxy error:', err);
    return res.status(500).send(err?.message || 'Erro no proxy');
  }
});

// -----------------------------------------------------------------------------
// POST /api/gcs/images/upload
// multipart/form-data:
//  - image: arquivo
//  - sku: SKU do produto
// -----------------------------------------------------------------------------
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const sku = sanitizeSku(req.body?.sku);
    if (!sku) return res.status(400).json({ ok: false, message: 'sku é obrigatório' });

    const file = req.file;
    if (!file) return res.status(400).json({ ok: false, message: 'arquivo "image" é obrigatório' });

    const safeExt = normalizeExt(file.originalname);
    const filename = `${sku}${safeExt}`;

    const key = `${IMAGES_BASE_PREFIX}/${sku}/${Date.now()}-${filename}`.replace(/\/+/g, '/');

    const out = await gcs.uploadBuffer({
      bucket: BUCKET,
      key,
      filename,
      buffer: file.buffer,
      contentType: file.mimetype || 'application/octet-stream',
      cacheControl: 'public, max-age=3600'
    });

    if (!out?.ok) {
      return res.status(500).json({ ok: false, message: out?.message || 'Falha ao enviar ao GCS' });
    }

    const signedUrl = await gcs.getSignedURL({
      bucket: out.bucket || BUCKET,
      key: out.key || key,
      action: 'read',
      expiresMinutes: 30
    });

    return res.json({
      ok: true,
      bucket: out.bucket || BUCKET,
      key: out.key || key,
      url: out.url || null,
      signedUrl: signedUrl || null
    });
  } catch (err) {
    console.error('[gcsImages] upload error:', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro no upload' });
  }
});

export default router;

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ services/gcs.js (ESM) – Camada de GCS com fallback local/no-op      ║
/* ║ Compatível com chamadas "diretas" (bucket+key) e por prefixos       ║ */
// ╚══════════════════════════════════════════════════════════════════════╝

import { Storage } from '@google-cloud/storage';
import path from 'path';

/* ──────────────────────────────
   Config & boot
   ────────────────────────────── */
const IS_PROD = process.env.NODE_ENV === 'production';

// bucket "default" (usado nos modos por prefixo e como fallback)
const DEFAULT_BUCKET =
  process.env.GCS_BUCKET ||
  process.env.GOOGLE_CLOUD_BUCKET ||
  process.env.UPLOAD_BUCKET ||
  '';

const BASE_PREFIX = (process.env.GCS_PREFIX || 'doc.contabil').replace(/^\/+|\/+$/g, '');

if (!DEFAULT_BUCKET) {
  console.warn(
    '[GCS] Nenhum bucket default configurado (GCS_BUCKET/GOOGLE_CLOUD_BUCKET/UPLOAD_BUCKET vazio). Modo no-op para chamadas que dependem do default.'
  );
}

const storage = new Storage();
function getBucketRef(name) {
  const b = String(name || DEFAULT_BUCKET).trim();
  if (!b) return null;
  return storage.bucket(b);
}
export const bucket = getBucketRef(DEFAULT_BUCKET);

/* ──────────────────────────────
   Utils
   ────────────────────────────── */
const hasBucket = (b = bucket) => !!b;

function sanitizeFileName(name) {
  const base = path.basename(name || 'arquivo');
  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
}
function addSuffix(name, suffix) {
  const i = name.lastIndexOf('.');
  if (i <= 0) return `${name}${suffix}`;
  return `${name.slice(0, i)}${suffix}${name.slice(i)}`;
}
function normalizePrefix(p) {
  const s = String(p || '').replace(/^\/+/, '').replace(/\/+$/, '');
  return s.length ? s : '';
}
function endsWithYearMonth(p) {
  return /\/\d{4}\/\d{2}$/.test(String(p));
}

/** Remove `gs://.../` e o `bucket/` do início do key, se vierem por engano. */
function normalizeKeyForBucket(bucketRef, key) {
  let k = String(key || '');
  k = k.replace(/^gs:\/\/[^/]+\/+/i, '');
  if (bucketRef?.name) {
    const re = new RegExp(`^${bucketRef.name}\\/+`, 'i');
    k = k.replace(re, '');
  }
  return k.replace(/^\/+/, '');
}

// "gs://bucket/path" → { bucket, key }
// "bucket/path"      → { bucket, key }
// "path/only"        → { bucket: DEFAULT_BUCKET, key: path/only }
function parseBucketAndKey(input) {
  if (!input) return { bucket: DEFAULT_BUCKET, key: '' };

  if (typeof input === 'object' && input.bucket && input.key) {
    return { bucket: String(input.bucket), key: String(input.key).replace(/^\/+/, '') };
  }

  const s = String(input).trim();

  const gs = s.match(/^gs:\/\/([^/]+)\/(.+)$/i);
  if (gs) return { bucket: gs[1], key: gs[2].replace(/^\/+/, '') };

  if (s.includes('/')) {
    const [maybeBucket, ...rest] = s.split('/');
    const restPath = rest.join('/');
    if (DEFAULT_BUCKET && maybeBucket === DEFAULT_BUCKET) {
      return { bucket: maybeBucket, key: restPath.replace(/^\/+/, '') };
    }
    return { bucket: DEFAULT_BUCKET, key: s.replace(/^\/+/, '') };
  }

  return { bucket: DEFAULT_BUCKET, key: s.replace(/^\/+/, '') };
}

async function ensureUniqueObjectName(bucketRef, prefix, fileName) {
  if (!hasBucket(bucketRef)) return fileName;
  let finalName = fileName;
  let n = 1;
  while (true) {
    const [exists] = await bucketRef.file(`${prefix}/${finalName}`).exists();
    if (!exists) return finalName;
    finalName = addSuffix(fileName, `-${n++}`);
  }
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║  Prefixos antigos (mantidos por compatibilidade)                    ║
   ╚══════════════════════════════════════════════════════════════════════╝ */
export function buildPrefix({ date = new Date(), movId } = {}) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const base = `${normalizePrefix(BASE_PREFIX)}/${yyyy}/${mm}/${dd}`;
  return movId ? `${base}/mov-${movId}` : base;
}
export function buildBudgetPrefix({ date = new Date(), budgetId } = {}) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const base = `budgets/${yyyy}/${mm}/${dd}`;
  return budgetId ? `${base}/budget-${budgetId}` : base;
}
export function buildFiscalPrefix({ tipo = 'danfe', date = new Date() } = {}) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');

  const danfeBase = normalizePrefix(process.env.DANFE_GCS_PREFIX || 'nf-e.emitidas/pdf');
  const xmlBase = normalizePrefix(process.env.NFE_XML_GCS_PREFIX || 'nf-e.emitidas/xml');

  const base = String(tipo).toLowerCase() === 'xml' ? xmlBase : danfeBase;
  return endsWithYearMonth(base) ? base : `${base}/${yyyy}/${mm}`;
}
export function buildDanfePath({ id, date = new Date(), fileName } = {}) {
  const prefix = buildFiscalPrefix({ tipo: 'danfe', date });
  const name = fileName ? sanitizeFileName(fileName) : `danfe_${id}.pdf`;
  return `${prefix}/${name}`;
}
export function buildXmlPath({ chave, date = new Date(), fileName } = {}) {
  const prefix = buildFiscalPrefix({ tipo: 'xml', date });
  const name = fileName ? sanitizeFileName(fileName) : `${chave}.xml`;
  return `${prefix}/${name}`;
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║  API pública principal                                               ║
   ╚══════════════════════════════════════════════════════════════════════╝ */
export async function uploadBuffer(opts = {}) {
  // (modo moderno)
  if (opts.bucket && opts.key) {
    const bucketRef = getBucketRef(opts.bucket);
    if (!hasBucket(bucketRef)) {
      return {
        ok: false,
        url: null,
        bucket: null,
        key: opts.key || null,
        name: sanitizeFileName(opts.filename),
      };
    }

    const name = sanitizeFileName(opts.filename || path.basename(String(opts.key)));
    const key = normalizeKeyForBucket(bucketRef, opts.key);
    const file = bucketRef.file(key);

    await file.save(opts.buffer, {
      metadata: {
        contentType: opts.contentType || 'application/octet-stream',
        contentDisposition: opts.contentDisposition,
        cacheControl: opts.cacheControl,
        ...(opts.metadata || {}),
      },
      resumable: false,
      public: false,
      validation: 'crc32c',
    });

    return {
      ok: true,
      bucket: bucketRef.name,
      key,
      name,
      url: `https://storage.googleapis.com/${bucketRef.name}/${encodeURI(key)}`,
    };
  }

  // (modo antigo)
  const bucketRef = bucket;
  if (!hasBucket(bucketRef)) {
    return { ok: false, url: null, bucket: null, key: null, name: sanitizeFileName(opts.filename) };
  }

  let prefix;
  if (opts.usePrefix === 'budget') {
    prefix = buildBudgetPrefix({ date: opts.date, budgetId: opts.budgetId });
  } else if (opts.usePrefix?.startsWith('fiscal')) {
    const tipo = opts.usePrefix.includes(':xml') ? 'xml' : 'danfe';
    prefix = buildFiscalPrefix({ tipo, date: opts.date });
  } else {
    prefix = buildPrefix({ date: opts.date, movId: opts.movId });
  }

  const safeName = sanitizeFileName(opts.filename || 'arquivo');
  const objectName = (opts.ensureUnique ?? true)
    ? await ensureUniqueObjectName(bucketRef, prefix, safeName)
    : safeName;

  const key = `${prefix}/${objectName}`;
  const file = bucketRef.file(key);

  await file.save(opts.buffer, {
    metadata: {
      contentType: opts.contentType || 'application/octet-stream',
      contentDisposition: opts.contentDisposition,
      cacheControl: opts.cacheControl,
    },
    resumable: false,
    public: false,
    validation: 'crc32c',
  });

  return {
    ok: true,
    bucket: bucketRef.name,
    key,
    name: objectName,
    url: `https://storage.googleapis.com/${bucketRef.name}/${encodeURI(key)}`,
  };
}

/** Novo: retorna o conteúdo de um arquivo como Buffer */
export async function getFileBuffer({ bucket, key }) {
  const bucketRef = getBucketRef(bucket);
  if (!hasBucket(bucketRef)) throw new Error('Bucket inválido ou não configurado');
  const normKey = normalizeKeyForBucket(bucketRef, key);
  const file = bucketRef.file(normKey);
  const [exists] = await file.exists();
  if (!exists) throw new Error(`Arquivo não encontrado: gs://${bucket}/${key}`);
  const [buffer] = await file.download();
  return buffer;
}

export function getFile(ref) {
  const { bucket: bkt, key } = parseBucketAndKey(ref);
  const bucketRef = getBucketRef(bkt);
  if (!hasBucket(bucketRef) || !key) return null;
  return bucketRef.file(key);
}

export function createReadStream(ref, opts) {
  const f = getFile(ref);
  return f ? f.createReadStream(opts) : null;
}

export async function getSignedURL(arg1, arg2) {
  let bucketName, key, action, expiresMs;

  if (typeof arg1 === 'object' && arg1 && !arg2) {
    ({ bucket: bucketName, key, action = 'read' } = arg1);
    const { expiresSeconds, expiresMinutes } = arg1;
    expiresMs =
      (expiresSeconds != null
        ? Number(expiresSeconds)
        : Number(expiresMinutes ?? 15) * 60) * 1000;
  } else {
    key = String(arg1 || '');
    const { bucket: b, action: a = 'read', expiresSeconds, expiresMinutes = 15 } =
      arg2 || {};
    bucketName = b || DEFAULT_BUCKET;
    expiresMs =
      (expiresSeconds != null
        ? Number(expiresSeconds)
        : Number(expiresMinutes) * 60) * 1000;
    action = a;
  }

  const bucketRef = getBucketRef(bucketName);
  if (!hasBucket(bucketRef) || !key) return null;

  const normKey = normalizeKeyForBucket(bucketRef, key);
  const file = bucketRef.file(normKey);
  const [url] = await file.getSignedUrl({
    action: action || 'read',
    expires: Date.now() + (expiresMs || 15 * 60 * 1000),
  });
  return url;
}

export async function listByPrefix(prefix, { signed = false, expiresMinutes = 15 } = {}) {
  if (!hasBucket(bucket)) return [];
  const p = normalizePrefix(prefix);
  const [files] = await bucket.getFiles({ prefix: p.endsWith('/') ? p : `${p}/` });
  const out = [];
  for (const f of files) {
    const item = {
      name: f.name,
      size: Number(f.metadata?.size || 0),
      updated: f.metadata?.updated || null,
    };
    if (signed) {
      const [url] = await f.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresMinutes * 60 * 1000,
      });
      item.url = url;
    }
    out.push(item);
  }
  return out;
}

export async function listManyByPrefixes(prefixes = [], opts) {
  if (!hasBucket(bucket)) return (prefixes || []).map(() => []);
  return Promise.all((prefixes || []).map((p) => listByPrefix(p, opts)));
}

export async function exists(ref) {
  const f = getFile(ref);
  if (!f) return false;
  const [e] = await f.exists();
  return !!e;
}

/* Export default prático */
export default {
  bucket,
  uploadBuffer,
  getFileBuffer, // ✅ adicionado
  getFile,
  createReadStream,
  getSignedURL,
  listByPrefix,
  listManyByPrefixes,
  exists,
  buildPrefix,
  buildBudgetPrefix,
  buildFiscalPrefix,
  buildDanfePath,
  buildXmlPath,
};

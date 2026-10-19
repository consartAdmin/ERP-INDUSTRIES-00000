// ╔══════════════════════════════════════════════════════════════════════╗
// ║ File: backend/uploadBuckets/uploadBucketsCashMoviments.js           ║
// ║ Desc: Upload + List + Delete de anexos do Caixa (GCS + Postgres)    ║
// ║ CONSART ERP — ESM                                                   ║
// ║ ✅ Usa "cashMovimentsAttachments"                                   ║
// ║ ✅ Compatível com movId / movimentacao_id / cash_movement_id         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import multer from 'multer';
import { Storage } from '@google-cloud/storage';
import pool from '../config/db.js';

const BUCKET_NAME = String(process.env.GCS_BUCKET || 'erp-infinity-00000')
  .trim()
  .replace(/^gs:\/\//i, '')
  .replace(/\/+$/g, '');
const BASE_PREFIX = (process.env.CAIXA_PREFIX || 'cashMoviments').replace(/^\/+|\/+$/g, '');
const PROJECT_ID = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

const storage = new Storage(PROJECT_ID ? { projectId: PROJECT_ID } : undefined);
const bucket = storage.bucket(BUCKET_NAME);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const pad2 = (n) => String(n).padStart(2, '0');

function slugifyName(name) {
  return String(name || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function todayParts(d = new Date()) {
  return {
    y: d.getFullYear(),
    m: pad2(d.getMonth() + 1),
    d: pad2(d.getDate()),
  };
}

function publicUrl(bucketName, objectName) {
  return `https://storage.googleapis.com/${encodeURIComponent(bucketName)}/${encodeURIComponent(objectName).replace(/%2F/g, '/')}`;
}

function buildObjectPath({ basePrefix = BASE_PREFIX, movId, originalName, date = new Date() }) {
  const { y, m, d } = todayParts(date);
  const ts = Math.floor(Date.now() / 1000);
  const safe = slugifyName(originalName || 'anexo.bin');

  return `${basePrefix}/${y}/${m}/${d}/mov-${movId}/${ts}-${safe}`;
}

// Pasta raiz do anexo no bucket (ex.: cashMoviments, debts). Só letras,
// números, '-' e '_'; qualquer outro valor cai no padrão do Caixa.
function safeBasePrefix(v) {
  const p = String(v || '').replace(/^\/+|\/+$/g, '');
  return /^[A-Za-z0-9_-]{1,40}$/.test(p) ? p : BASE_PREFIX;
}

function isFinitePositiveInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && Number.isInteger(n);
}

function rid(req) {
  return req.get?.('x-request-id') || req.headers?.['x-request-id'] || null;
}

function j(o) {
  try {
    return JSON.stringify(o);
  } catch {
    return String(o);
  }
}

function logInfoEtapa(req, etapa, extra = {}) {
  console.log(j({
    ts: new Date().toISOString(),
    lvl: 'INFO',
    rid: rid(req),
    mod: 'uploadCash',
    etapa,
    ...extra,
  }));
}

function logErrEtapa(req, etapa, err, extra = {}) {
  console.error(j({
    ts: new Date().toISOString(),
    lvl: 'ERROR',
    rid: rid(req),
    mod: 'uploadCash',
    etapa,
    err: {
      msg: err?.message,
      code: err?.code,
      stack: err?.stack,
    },
    ...extra,
  }));
}

async function withRetry(fn, { tries = 3, baseMs = 150 } = {}) {
  let lastErr;

  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) {
        await new Promise((r) => setTimeout(r, baseMs * Math.pow(2, i)));
      }
    }
  }

  throw lastErr;
}

function getMovementIdFromReq(req) {
  return (
    req.body?.cash_movement_id ??
    req.body?.movimentacao_id ??
    req.body?.movId ??
    req.params?.id ??
    req.query?.cash_movement_id ??
    req.query?.movimentacao_id
  );
}

async function handleUploadAnexo(req, res) {
  const requestId = rid(req);
  let etapaAtual = 'validacao.inicio';
  let uploadedObjectName = null;

  try {
    const rawMovId = getMovementIdFromReq(req);
    const movIdNum = Number(rawMovId);

    logInfoEtapa(req, 'validacao.inicio', {
      hasFile: !!req.file,
      movId: rawMovId,
      mime: req.file?.mimetype,
      size: req.file?.size,
    });

    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: 'Arquivo ausente (campo "arquivo").',
        rid: requestId,
      });
    }

    if (!isFinitePositiveInt(movIdNum)) {
      return res.status(400).json({
        ok: false,
        error: 'movId inválido (salve a movimentação antes de enviar anexos).',
        rid: requestId,
      });
    }

    etapaAtual = 'bucket.exists';
    logInfoEtapa(req, etapaAtual, {
      projectId: PROJECT_ID || null,
      bucketName: BUCKET_NAME,
      credentialsConfigured: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    });

    const [exists] = await bucket.exists();

    if (!exists) {
      return res.status(500).json({
        ok: false,
        error: `Bucket não existe ou sem permissão: ${BUCKET_NAME}`,
        rid: requestId,
      });
    }

    const basePrefix = safeBasePrefix(req.body?.basePrefix);
    const objectName = buildObjectPath({
      basePrefix,
      movId: movIdNum,
      originalName: req.file.originalname,
    });

    const file = bucket.file(objectName);

    etapaAtual = 'gcs.file.save';
    logInfoEtapa(req, etapaAtual, {
      bucketName: BUCKET_NAME,
      objectName,
      size: req.file.size,
      mime: req.file.mimetype,
    });

    await withRetry(
      () => file.save(req.file.buffer, {
        resumable: false,
        contentType: req.file.mimetype || 'application/octet-stream',
        metadata: {
          cacheControl: 'no-store',
          metadata: {
            module: basePrefix,
            cash_movement_id: String(movIdNum),
            originalName: req.file.originalname || '',
          },
        },
        preconditionOpts: { ifGenerationMatch: 0 },
      }),
      { tries: 3, baseMs: 150 }
    );

    uploadedObjectName = objectName;

    const url = publicUrl(BUCKET_NAME, objectName);

    const sql = `
      INSERT INTO "cashMovimentsAttachments"
        (
          cash_movement_id,
          file_name,
          mime_type,
          file_size_bytes,
          storage_bucket,
          storage_path
        )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        cash_movement_id,
        cash_movement_id AS movimentacao_id,
        file_name,
        file_name AS filename,
        mime_type,
        file_size_bytes,
        file_size_bytes AS size_bytes,
        storage_bucket,
        storage_bucket AS gcs_bucket,
        storage_path,
        storage_path AS gcs_path,
        created_at
    `;

    const params = [
      movIdNum,
      req.file.originalname || 'arquivo',
      req.file.mimetype || 'application/octet-stream',
      Number(req.file.size || 0),
      BUCKET_NAME,
      objectName,
    ];

    etapaAtual = 'database.insert';
    logInfoEtapa(req, etapaAtual, {
      movId: movIdNum,
      bucketName: BUCKET_NAME,
      objectName,
    });

    const { rows } = await pool.query(sql, params);
    const anexo = rows?.[0];

    return res.status(201).json({
      ok: true,
      bucket: BUCKET_NAME,
      object: objectName,
      url,
      saved: true,
      anexo: { ...anexo, url },
      rid: requestId,
    });
  } catch (err) {
    if (uploadedObjectName && etapaAtual === 'database.insert') {
      try {
        await bucket.file(uploadedObjectName).delete({ ignoreNotFound: true });
        logInfoEtapa(req, 'rollback.gcs.delete', { objectName: uploadedObjectName });
      } catch (rollbackErr) {
        logErrEtapa(req, 'rollback.gcs.delete', rollbackErr, {
          objectName: uploadedObjectName,
        });
      }
    }

    logErrEtapa(req, etapaAtual, err, {
      projectId: PROJECT_ID || null,
      bucketName: BUCKET_NAME,
    });
    return res.status(500).json({
      ok: false,
      error: 'Falha ao subir anexo',
      details: String(err.message || err),
      stage: etapaAtual,
      code: err?.code || null,
      rid: requestId,
    });
  }
}

function uploadSingleArquivo(req, res, next) {
  upload.single('arquivo')(req, res, (err) => {
    if (!err) return next();

    const status = err instanceof multer.MulterError ? 400 : 500;
    logErrEtapa(req, 'multer.parse', err);

    return res.status(status).json({
      ok: false,
      error: err instanceof multer.MulterError
        ? 'Arquivo inválido para upload'
        : 'Falha ao processar o arquivo',
      details: err?.message || String(err),
      stage: 'multer.parse',
      code: err?.code || null,
      rid: rid(req),
    });
  });
}

export const uploadAnexoCaixa = [uploadSingleArquivo, handleUploadAnexo];

export async function signAnexoGcs(req, res) {
  try {
    const { movId, cash_movement_id, movimentacao_id, filename, mimeType, basePrefix } = req.body || {};
    const finalMovId = cash_movement_id ?? movimentacao_id ?? movId;

    if (!isFinitePositiveInt(finalMovId)) {
      return res.status(400).json({ ok: false, error: 'movId inválido' });
    }

    if (!filename || String(filename).trim() === '') {
      return res.status(400).json({ ok: false, error: 'filename é obrigatório' });
    }

    const contentType = String(mimeType || 'application/octet-stream');

    const objectName = buildObjectPath({
      basePrefix: (basePrefix || BASE_PREFIX).replace(/^\/+|\/+$/g, ''),
      movId: Number(finalMovId),
      originalName: filename,
    });

    const file = bucket.file(objectName);
    const expires = Date.now() + 15 * 60 * 1000;

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires,
      contentType,
    });

    return res.json({
      ok: true,
      method: 'PUT',
      url,
      bucket: BUCKET_NAME,
      object: objectName,
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(expires).toISOString(),
    });
  } catch (err) {
    console.error('[UPLOAD][SIGN][ERR]', err);
    return res.status(500).json({
      ok: false,
      error: 'Falha ao assinar upload',
      details: String(err.message || err),
    });
  }
}

export async function signReadAnexo(req, res) {
  try {
    const object = String(req.query.object || req.query.gcs_path || req.query.storage_path || '').trim();

    if (!object) {
      return res.status(400).json({ ok: false, error: 'object obrigatório' });
    }

    const file = bucket.file(object);
    const expires = Date.now() + 10 * 60 * 1000;

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires,
    });

    return res.json({
      ok: true,
      url,
      expiresAt: new Date(expires).toISOString(),
    });
  } catch (err) {
    console.error('[UPLOAD][SIGN_READ][ERR]', err);
    return res.status(500).json({
      ok: false,
      error: 'Falha ao assinar leitura',
      details: String(err.message || err),
    });
  }
}

export async function confirmAnexoGcs(req, res) {
  try {
    const {
      movId,
      movimentacao_id,
      cash_movement_id,
      filename,
      file_name,
      mimeType,
      mime_type,
      sizeBytes,
      size_bytes,
      file_size_bytes,
      bucket: bIn,
      object,
      gcs_path,
      storage_path,
    } = req.body || {};

    const finalMovId = cash_movement_id ?? movimentacao_id ?? movId;
    const finalObject = object ?? storage_path ?? gcs_path;

    if (!isFinitePositiveInt(finalMovId)) {
      return res.status(400).json({ ok: false, error: 'movId inválido' });
    }

    if (!finalObject || String(finalObject).trim() === '') {
      return res.status(400).json({ ok: false, error: 'object é obrigatório' });
    }

    const bucketName = bIn || BUCKET_NAME;
    const finalFileName = file_name ?? filename ?? String(finalObject).split('/').pop() ?? 'arquivo';
    const finalMime = mime_type ?? mimeType ?? 'application/octet-stream';
    const finalSize = file_size_bytes ?? size_bytes ?? sizeBytes ?? 0;
    const url = publicUrl(bucketName, finalObject);

    const sql = `
      INSERT INTO "cashMovimentsAttachments"
        (
          cash_movement_id,
          file_name,
          mime_type,
          file_size_bytes,
          storage_bucket,
          storage_path
        )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        cash_movement_id,
        cash_movement_id AS movimentacao_id,
        file_name,
        file_name AS filename,
        mime_type,
        file_size_bytes,
        file_size_bytes AS size_bytes,
        storage_bucket,
        storage_bucket AS gcs_bucket,
        storage_path,
        storage_path AS gcs_path,
        created_at
    `;

    const { rows } = await pool.query(sql, [
      Number(finalMovId),
      finalFileName,
      finalMime,
      Number(finalSize || 0),
      bucketName,
      finalObject,
    ]);

    const anexo = rows[0];

    return res.status(201).json({
      ok: true,
      saved: true,
      anexo: { ...anexo, url },
    });
  } catch (err) {
    console.error('[UPLOAD][CONFIRM][ERR]', err);
    return res.status(500).json({
      ok: false,
      error: 'Falha ao confirmar anexo',
      details: String(err.message || err),
    });
  }
}

export async function listAnexosCaixa(req, res) {
  try {
    const id = Number(req.params.id ?? req.query.cash_movement_id ?? req.query.movimentacao_id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'id inválido' });
    }

    const sql = `
      SELECT
        id,
        cash_movement_id,
        cash_movement_id AS movimentacao_id,
        file_name,
        file_name AS filename,
        mime_type,
        file_size_bytes,
        file_size_bytes AS size_bytes,
        storage_bucket,
        storage_bucket AS gcs_bucket,
        storage_path,
        storage_path AS gcs_path,
        ('https://storage.googleapis.com/' || storage_bucket || '/' || storage_path) AS url,
        created_at
      FROM "cashMovimentsAttachments"
      WHERE cash_movement_id = $1
      ORDER BY id DESC
    `;

    const { rows } = await pool.query(sql, [id]);
    return res.json(rows);
  } catch (err) {
    console.error('[ANEXOS][LIST][ERR]', err);
    return res.status(500).json({ ok: false, error: 'Falha ao listar anexos' });
  }
}

export async function countAnexosCaixa(req, res) {
  try {
    const id = Number(req.params.id ?? req.query.cash_movement_id ?? req.query.movimentacao_id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'id inválido' });
    }

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM "cashMovimentsAttachments" WHERE cash_movement_id = $1`,
      [id]
    );

    return res.json({ count: rows[0]?.c ?? 0 });
  } catch (err) {
    console.error('[ANEXOS][COUNT][ERR]', err);
    return res.status(500).json({ ok: false, error: 'Falha ao contar anexos' });
  }
}

export async function deleteAnexoCaixa(req, res) {
  try {
    const movId = Number(req.params.id);
    const anexoId = Number(req.params.anexoId);

    if (!Number.isFinite(movId) || !Number.isFinite(anexoId)) {
      return res.status(400).json({ ok: false, error: 'ids inválidos' });
    }

    const { rows } = await pool.query(
      `
      SELECT storage_bucket, storage_path
      FROM "cashMovimentsAttachments"
      WHERE id = $1
        AND cash_movement_id = $2
      `,
      [anexoId, movId]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'anexo não encontrado' });
    }

    const storageBucket = rows[0].storage_bucket;
    const storagePath = rows[0].storage_path;

    await storage
      .bucket(storageBucket)
      .file(storagePath)
      .delete({ ignoreNotFound: true });

    await pool.query(
      `
      DELETE FROM "cashMovimentsAttachments"
      WHERE id = $1
        AND cash_movement_id = $2
      `,
      [anexoId, movId]
    );

    return res.json({
      ok: true,
      deleted: true,
      storage_path: storagePath,
    });
  } catch (err) {
    console.error('[ANEXOS][DELETE][ERR]', err);
    return res.status(500).json({ ok: false, error: 'Falha ao excluir anexo' });
  }
}

export async function diagUpload(req, res) {
  try {
    const info = {
      ok: true,
      rid: rid(req),
      project: PROJECT_ID || null,
      bucket: BUCKET_NAME,
      basePrefix: BASE_PREFIX,
      credsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
      hints: [
        'Garanta que a Service Account tenha storage.objects.create/list/delete no bucket.',
        'Se estiver local, defina GOOGLE_APPLICATION_CREDENTIALS apontando para o JSON da SA.',
        'Confirme GCS_BUCKET e CAIXA_PREFIX nas variáveis de ambiente.',
      ],
    };

    const [exists] = await bucket.exists();
    info.bucketExists = !!exists;

    const { y, m, d } = todayParts();
    const prefix = `${BASE_PREFIX}/${y}/${m}/${d}/`;

    const [files] = await bucket.getFiles({ prefix, maxResults: 10 }).catch((e) => {
      info.listError = { msg: e?.message, code: e?.code };
      return [[]];
    });

    info.sampleList = files?.map((f) => f.name) || [];

    return res.json(info);
  } catch (err) {
    logErrEtapa(req, 'diagUpload.err', err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}

export const signAnexoCaixa = (req, res) => signAnexoGcs(req, res);
export const confirmAnexoCaixa = (req, res) => confirmAnexoGcs(req, res);

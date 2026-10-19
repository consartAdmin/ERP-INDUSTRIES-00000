// ╔══════════════════════════════════════════════════════════════════════╗
// ║ File: backend/uploadBuckets/uploadBucketsAccountsPayable.js         ║
// ║ Desc: Upload + List + Delete de anexos do Contas a Pagar            ║
// ║       (GCS + Postgres)                                              ║
// ║ Padrão: ESM                                                         ║
// ║ Reqs: @google-cloud/storage, multer                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import multer from 'multer';
import { Storage } from '@google-cloud/storage';
import pool from '../config/db.js';

// ===== Config por ENV =====
const BUCKET_NAME = String(
  process.env.ACCOUNTS_PAYABLE_GCS_BUCKET || ''
).trim();

const BASE_PREFIX = String(
  process.env.ACCOUNTS_PAYABLE_GCS_PREFIX ||
  'accountsPayable'
).replace(/^\/+|\/+$/g, '');

const SIGNED_URL_TTL = Math.max(
  60,
  Number(
    process.env.ACCOUNTS_PAYABLE_GCS_SIGNED_URL_TTL || 900
  )
);

if (!BUCKET_NAME) {
  throw new Error(
    'ACCOUNTS_PAYABLE_GCS_BUCKET is required'
  );
}

const PROJECT_ID = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

// Se estiver fora do GCP, exporte GOOGLE_APPLICATION_CREDENTIALS com o JSON da SA.
const storage = new Storage(PROJECT_ID ? { projectId: PROJECT_ID } : undefined);
const bucket = storage.bucket(BUCKET_NAME);

// ===== Multer em memória =====
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ===== Helpers =====
const pad2 = (n) => String(n).padStart(2, '0');

function slugifyName(name) {
  return String(name || 'arquivo')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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

function isFinitePositiveInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && Number.isInteger(n);
}

function normalizeFileType({ fileType, originalName, mimeType }) {
  const ft = String(fileType || '').trim().toUpperCase();
  if (ft) return ft;

  const lowerName = String(originalName || '').toLowerCase();
  const lowerMime = String(mimeType || '').toLowerCase();

  if (lowerName.endsWith('.xml') || lowerMime.includes('xml')) return 'XML';
  if (lowerName.endsWith('.pdf') || lowerMime.includes('pdf')) return 'DANFE';

  return 'OUTRO';
}

function inferObjectFromUrl(url) {
  const prefix = `https://storage.googleapis.com/${BUCKET_NAME}/`;
  if (!url || typeof url !== 'string') return null;
  if (!url.startsWith(prefix)) return null;

  const raw = url.slice(prefix.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Padrão:
 * taxDocuments/accountsPayable/YYYY/MM/DD/<accountPayableId>/<timestamp>-<arquivo>
 */
function buildObjectPath({ basePrefix = BASE_PREFIX, accountPayableId, originalName, date = new Date() }) {
  const { y, m, d } = todayParts(date);
  const ts = Math.floor(Date.now() / 1000);
  const safe = slugifyName(originalName || 'anexo.bin');
  return `${basePrefix}/${y}/${m}/${d}/${accountPayableId}/${ts}-${safe}`;
}

// ===== LOG & RETRY HELPERS =====
function rid(req) {
  return req.get?.('x-request-id') || req.headers?.['x-request-id'] || null;
}

function j(o) {
  try { return JSON.stringify(o); } catch { return String(o); }
}

function logInfoEtapa(req, etapa, extra = {}) {
  console.log(j({
    ts: new Date().toISOString(),
    lvl: 'INFO',
    rid: rid(req),
    mod: 'uploadAccountsPayable',
    etapa,
    ...extra,
  }));
}

function logErrEtapa(req, etapa, err, extra = {}) {
  console.error(j({
    ts: new Date().toISOString(),
    lvl: 'ERROR',
    rid: rid(req),
    mod: 'uploadAccountsPayable',
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

// ======================================================================
// 🔄 UPLOAD CLÁSSICO (compat) — POST /api/upload/accounts-payable/anexo
// Campo: "arquivo"
// Body: { accountPayableId, fileType?, basePrefix? }
// ======================================================================
async function handleUploadAnexo(req, res) {
  const requestId = rid(req);

  try {
    logInfoEtapa(req, 'validacao.inicio', {
      hasFile: !!req.file,
      accountPayableId: req.body?.accountPayableId,
      mime: req.file?.mimetype,
      size: req.file?.size,
      fileType: req.body?.fileType,
    });

    if (!req.file) {
      logErrEtapa(req, 'validacao.sem_arquivo', new Error('arquivo ausente'));
      return res.status(400).json({
        ok: false,
        error: 'Arquivo ausente (campo "arquivo").',
        rid: requestId,
      });
    }

    const payableIdStr = String(req.body.accountPayableId ?? '').trim();
    const payableIdNum = Number(payableIdStr);

    if (!payableIdStr || !Number.isFinite(payableIdNum)) {
      logErrEtapa(req, 'validacao.account_payable_invalido', new Error('accountPayableId inválido'), {
        accountPayableId: req.body?.accountPayableId,
      });
      return res.status(400).json({
        ok: false,
        error: 'accountPayableId inválido (salve a conta a pagar antes de enviar anexos).',
        rid: requestId,
      });
    }

    // valida se a conta existe
    const payableCheck = await pool.query(
      `SELECT id FROM "accountsPayable" WHERE id = $1 LIMIT 1`,
      [payableIdNum]
    );

    if (!payableCheck.rows.length) {
      return res.status(404).json({
        ok: false,
        error: 'Conta a pagar não encontrada.',
        rid: requestId,
      });
    }

    // Checa bucket
    logInfoEtapa(req, 'gcs.check_bucket.start', { bucket: BUCKET_NAME, project: PROJECT_ID });
    const [exists] = await bucket.exists().catch((e) => {
      logErrEtapa(req, 'gcs.check_bucket.err', e, { bucket: BUCKET_NAME });
      throw e;
    });

    if (!exists) {
      const msg = `Bucket não existe ou sem permissão: ${BUCKET_NAME}`;
      logErrEtapa(req, 'gcs.check_bucket.not_found', new Error(msg));
      return res.status(500).json({ ok: false, error: msg, rid: requestId });
    }

    logInfoEtapa(req, 'gcs.check_bucket.ok');

    const objectName = buildObjectPath({
      basePrefix: (req.body.basePrefix || BASE_PREFIX).replace(/^\/+|\/+$/g, ''),
      accountPayableId: payableIdNum,
      originalName: req.file.originalname,
    });

    logInfoEtapa(req, 'gcs.path.build', { object: objectName });

    // ===== Salva no bucket =====
    const file = bucket.file(objectName);

    const saveOpts = {
      resumable: false,
      contentType: req.file.mimetype || 'application/octet-stream',
      metadata: {
        cacheControl: 'no-store',
        metadata: {
          module: 'accountsPayable',
          account_payable_id: String(payableIdNum),
          originalName: req.file.originalname || '',
          fileType: normalizeFileType({
            fileType: req.body.fileType,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
          }),
        },
      },
      preconditionOpts: { ifGenerationMatch: 0 },
    };

    logInfoEtapa(req, 'gcs.save.start', {
      size: req.file.size,
      mime: saveOpts.contentType,
    });

    await withRetry(
      () => file.save(req.file.buffer, saveOpts),
      { tries: 3, baseMs: 150 }
    ).catch((e) => {
      logErrEtapa(req, 'gcs.save.err', e, { object: objectName, bucket: BUCKET_NAME });
      throw e;
    });

    logInfoEtapa(req, 'gcs.save.ok', { object: objectName });

    const url = publicUrl(BUCKET_NAME, objectName);
    const fileType = normalizeFileType({
      fileType: req.body.fileType,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    // ===== Persiste no Postgres =====
    const sql = `
      INSERT INTO "accountsPayableAttachments"
        (account_payable_id, file_type, file_name, file_url)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (account_payable_id, file_type, file_url) DO NOTHING
      RETURNING id, account_payable_id, file_type, file_name, file_url, created_at
    `;
    const params = [
      payableIdNum,
      fileType,
      req.file.originalname || 'arquivo',
      url,
    ];

    logInfoEtapa(req, 'pg.insert.start', { table: 'accountsPayableAttachments' });
    const { rows } = await pool.query(sql, params).catch((e) => {
      logErrEtapa(req, 'pg.insert.err', e, { sql, params });
      throw e;
    });

    let anexo = rows?.[0] || null;

    // se não retornou por conta do ON CONFLICT DO NOTHING, busca o registro existente
    if (!anexo) {
      const existing = await pool.query(
        `
        SELECT id, account_payable_id, file_type, file_name, file_url, created_at
          FROM "accountsPayableAttachments"
         WHERE account_payable_id = $1
           AND file_type = $2
           AND file_url = $3
         LIMIT 1
        `,
        [payableIdNum, fileType, url]
      );
      anexo = existing.rows?.[0] || null;
    }

    logInfoEtapa(req, 'pg.insert.ok', { anexoId: anexo?.id || null });

    return res.status(201).json({
      ok: true,
      bucket: BUCKET_NAME,
      object: objectName,
      url,
      saved: true,
      anexo,
      rid: requestId,
    });
  } catch (err) {
    logErrEtapa(req, 'upload.fatal', err, {
      env: {
        GCS_BUCKET: BUCKET_NAME,
        ACCOUNTS_PAYABLE_PREFIX: BASE_PREFIX,
        GCP_PROJECT: PROJECT_ID,
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS ? '(set)' : '(unset)',
      },
    });

    return res.status(500).json({
      ok: false,
      error: 'Falha ao subir anexo do contas a pagar',
      details: String(err.message || err),
      rid: requestId,
    });
  }
}

export const uploadAnexoAccountsPayable = [upload.single('arquivo'), handleUploadAnexo];

// ======================================================================
// ☁️ ASSINATURA PARA UPLOAD DIRETO (PUT V4)
// POST /api/upload/accounts-payable/anexo/sign
// Body: { accountPayableId, filename, mimeType?, fileType?, basePrefix? }
// ======================================================================
export async function signAnexoGcsAccountsPayable(req, res) {
  try {
    const { accountPayableId, filename, mimeType, fileType, basePrefix } = req.body || {};

    if (!isFinitePositiveInt(accountPayableId)) {
      return res.status(400).json({ ok: false, error: 'accountPayableId inválido' });
    }

    if (!filename || String(filename).trim() === '') {
      return res.status(400).json({ ok: false, error: 'filename é obrigatório' });
    }

    const payableCheck = await pool.query(
      `SELECT id FROM "accountsPayable" WHERE id = $1 LIMIT 1`,
      [Number(accountPayableId)]
    );

    if (!payableCheck.rows.length) {
      return res.status(404).json({ ok: false, error: 'Conta a pagar não encontrada' });
    }

    const contentType = String(mimeType || 'application/octet-stream');

    const objectName = buildObjectPath({
      basePrefix: BASE_PREFIX.replace(/^\/+|\/+$/g, ''),
      accountPayableId: Number(accountPayableId),
      originalName: filename,
    });

    const file = bucket.file(objectName);
    const expires = Date.now() + 15 * 60 * 1000; // 15 min

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
      fileType: normalizeFileType({ fileType, originalName: filename, mimeType: contentType }),
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(expires).toISOString(),
    });
  } catch (err) {
    console.error('[UPLOAD][ACCOUNTS_PAYABLE][SIGN][ERR]', err);
    return res.status(500).json({
      ok: false,
      error: 'Falha ao assinar upload',
      details: String(err.message || err),
    });
  }
}

// ======================================================================
// 🔐 LEITURA ASSINADA (GET)
// GET /api/upload/accounts-payable/anexo/sign-read?object=<gcs_path>
// ou ?url=<file_url>
// ======================================================================
export async function signReadAnexoAccountsPayable(req, res) {
  try {
    let object = String(req.query.object || '').trim();
    const url = String(req.query.url || '').trim();

    if (!object && url) {
      object = inferObjectFromUrl(url) || '';
    }

    if (!object) {
      return res.status(400).json({ ok: false, error: 'object ou url obrigatório' });
    }

    const file = bucket.file(object);
    const expires = Date.now() + 10 * 60 * 1000; // 10 min

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires,
    });

    return res.json({
      ok: true,
      url: signedUrl,
      object,
      expiresAt: new Date(expires).toISOString(),
    });
  } catch (err) {
    console.error('[UPLOAD][ACCOUNTS_PAYABLE][SIGN_READ][ERR]', err);
    return res.status(500).json({
      ok: false,
      error: 'Falha ao assinar leitura',
      details: String(err.message || err),
    });
  }
}

// ======================================================================
// ✅ CONFIRMA METADADOS APÓS UPLOAD DIRETO (PUT)
// POST /api/upload/accounts-payable/anexo/confirm
// Body: { accountPayableId, filename, mimeType, fileType?, bucket?, object }
// ======================================================================
export async function confirmAnexoGcsAccountsPayable(req, res) {
  try {
    const { accountPayableId, filename, mimeType, fileType, bucket: bIn, object } = req.body || {};

    if (!isFinitePositiveInt(accountPayableId)) {
      return res.status(400).json({ ok: false, error: 'accountPayableId inválido' });
    }

    if (!object || String(object).trim() === '') {
      return res.status(400).json({ ok: false, error: 'object é obrigatório' });
    }

    const payableCheck = await pool.query(
      `SELECT id FROM "accountsPayable" WHERE id = $1 LIMIT 1`,
      [Number(accountPayableId)]
    );

    if (!payableCheck.rows.length) {
      return res.status(404).json({ ok: false, error: 'Conta a pagar não encontrada' });
    }

    const bucketName = bIn || BUCKET_NAME;
    const finalUrl = publicUrl(bucketName, object);
    const normalizedType = normalizeFileType({
      fileType,
      originalName: filename,
      mimeType,
    });

    const sql = `
      INSERT INTO "accountsPayableAttachments"
        (account_payable_id, file_type, file_name, file_url)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (account_payable_id, file_type, file_url) DO NOTHING
      RETURNING id, account_payable_id, file_type, file_name, file_url, created_at
    `;

    const params = [
      Number(accountPayableId),
      normalizedType,
      filename || object.split('/').pop() || 'arquivo',
      finalUrl,
    ];

    const { rows } = await pool.query(sql, params);

    let anexo = rows?.[0] || null;

    if (!anexo) {
      const existing = await pool.query(
        `
        SELECT id, account_payable_id, file_type, file_name, file_url, created_at
          FROM "accountsPayableAttachments"
         WHERE account_payable_id = $1
           AND file_type = $2
           AND file_url = $3
         LIMIT 1
        `,
        [Number(accountPayableId), normalizedType, finalUrl]
      );
      anexo = existing.rows?.[0] || null;
    }

    return res.status(201).json({
      ok: true,
      saved: true,
      anexo,
      bucket: bucketName,
      object,
      url: finalUrl,
    });
  } catch (err) {
    console.error('[UPLOAD][ACCOUNTS_PAYABLE][CONFIRM][ERR]', err);
    return res.status(500).json({
      ok: false,
      error: 'Falha ao confirmar anexo',
      details: String(err.message || err),
    });
  }
}

// ======================================================================
// GET /api/accounts-payable/:id/anexos  → lista anexos da conta
// ======================================================================
export async function listAnexosAccountsPayable(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'id inválido' });
    }

    const sql = `
      SELECT
        id,
        account_payable_id,
        file_type,
        file_name,
        file_url,
        created_at
      FROM "accountsPayableAttachments"
      WHERE account_payable_id = $1
      ORDER BY id DESC
    `;

    const { rows } = await pool.query(sql, [id]);
    return res.json(rows);
  } catch (err) {
    console.error('[ANEXOS][ACCOUNTS_PAYABLE][LIST][ERR]', err);
    return res.status(500).json({ ok: false, error: 'Falha ao listar anexos' });
  }
}

// ======================================================================
// GET /api/accounts-payable/:id/anexos/count  → contagem
// ======================================================================
export async function countAnexosAccountsPayable(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'id inválido' });
    }

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM "accountsPayableAttachments" WHERE account_payable_id = $1`,
      [id]
    );

    return res.json({ count: rows[0]?.c ?? 0 });
  } catch (err) {
    console.error('[ANEXOS][ACCOUNTS_PAYABLE][COUNT][ERR]', err);
    return res.status(500).json({ ok: false, error: 'Falha ao contar anexos' });
  }
}

// ======================================================================
// DELETE /api/accounts-payable/:id/anexos/:anexoId
// Remove do BD e tenta remover do bucket se o file_url for do bucket atual
// ======================================================================
export async function deleteAnexoAccountsPayable(req, res) {
  try {
    const payableId = Number(req.params.id);
    const anexoId = Number(req.params.anexoId);

    if (!Number.isFinite(payableId) || !Number.isFinite(anexoId)) {
      return res.status(400).json({ ok: false, error: 'ids inválidos' });
    }

    const { rows } = await pool.query(
      `
      SELECT id, file_url
        FROM "accountsPayableAttachments"
       WHERE id = $1
         AND account_payable_id = $2
       LIMIT 1
      `,
      [anexoId, payableId]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'anexo não encontrado' });
    }

    const fileUrl = rows[0].file_url;
    const object = inferObjectFromUrl(fileUrl);

    await pool.query(
      `DELETE FROM "accountsPayableAttachments" WHERE id = $1 AND account_payable_id = $2`,
      [anexoId, payableId]
    );

    if (object) {
      try {
        await storage.bucket(BUCKET_NAME).file(object).delete();
      } catch (e) {
        console.warn('[ANEXOS][ACCOUNTS_PAYABLE][DELETE][GCS_WARN]', e?.message || e);
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[ANEXOS][ACCOUNTS_PAYABLE][DELETE][ERR]', err);
    return res.status(500).json({ ok: false, error: 'Falha ao excluir anexo' });
  }
}

// ======================================================================
// DIAGNÓSTICO: GET /api/upload/accounts-payable/diag
// ======================================================================
export async function diagUploadAccountsPayable(req, res) {
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
        'Confirme GCS_BUCKET e ACCOUNTS_PAYABLE_PREFIX nas variáveis de ambiente.',
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
    logErrEtapa(req, 'diagUploadAccountsPayable.err', err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}

// ======================================================================
// ALIASES DE COMPATIBILIDADE
// ======================================================================
export const signAnexoAccountsPayable = (req, res) => signAnexoGcsAccountsPayable(req, res);
export const confirmAnexoAccountsPayable = (req, res) => confirmAnexoGcsAccountsPayable(req, res);
// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ mobilizedController.js — Controller (Express • ESM)                        ║
// ║ Path: backend/controllers/mobilizedController.js                           ║
// ║                                                                            ║
// ║ ✅ ATUALIZADO                                                             ║
// ║  - list retorna items_total (via API)                                      ║
// ║  - POST /:id/pdf/upload (upload PDF -> GCS -> atualiza metadados)          ║
// ║  - GET  /:id/pdf (gera PDF e baixa)                                        ║
// ║  - POST /:id/pdf/generate-upload (gera PDF + upload GCS + update)          ║
// ║                                                                            ║
// ║ ENV:                                                                       ║
// ║  - GCS_BUCKET=consart-erp                                                  ║
// ║  - (opcional) GCS_BUCKET_MOBILIZED=... (override)                          ║
// ║  - (opcional) GCS_PUBLIC_BASE=https://storage.googleapis.com               ║
// ╚════════════════════════════════════════════════════════════════════════════╝

'use strict';

import crypto from 'crypto';
import multer from 'multer';
import { Storage } from '@google-cloud/storage';

import * as api from '../repositories/mobilized/mobilized.index.js';
import { generateMobilizedPdf } from '../generationPdf/generateMobilizedPdf.js'; // ✅ precisa existir e retornar Buffer
import { generateMobilizedAllPdf } from '../generationPdf/generateMobilizedAllPdf.js';

/* ──────────────────────────────────────────────────────────────
   Helpers (response)
────────────────────────────────────────────────────────────── */
function ok(res, data, meta) {
  return res.json({ ok: true, data, ...(meta ? { meta } : {}) });
}

function fail(res, status, message, details) {
  return res.status(status).json({ ok: false, message, ...(details ? { details } : {}) });
}

function isPgMissingTable(err) {
  return err && (err.code === '42P01' || /does not exist/i.test(err.message || ''));
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getBucketName() {
  const bucket = process.env.GCS_BUCKET_MOBILIZED || process.env.GCS_BUCKET;
  if (!bucket) throw new Error('GCS_BUCKET (or GCS_BUCKET_MOBILIZED) is not configured');
  return bucket;
}

function getPublicBase() {
  return (process.env.GCS_PUBLIC_BASE || 'https://storage.googleapis.com').replace(/\/$/, '');
}

function safeObjectName(value) {
  const cleaned = String(value || 'file')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  return cleaned || 'file';
}

async function loadItemsWithAttachments(mobilizedId) {
  const [items, attachments] = await Promise.all([
    api.listMobilizedItems(mobilizedId),
    api.listMobilizedAttachments(mobilizedId),
  ]);

  const primaryByItem = new Map();

  for (const attachment of attachments) {
    if (
      attachment.status === 'ACTIVE' &&
      attachment.is_primary &&
      attachment.mobilized_item_id != null
    ) {
      primaryByItem.set(
        Number(attachment.mobilized_item_id),
        attachment
      );
    }
  }

  return items.map((item) => {
    const attachment = primaryByItem.get(
      Number(item.mobilized_item_id)
    );

    return {
      ...item,
      primary_attachment: attachment || null,
      image_url: attachment?.public_url || null,
      image_object_path: attachment?.object_path || null,
    };
  });
}

/* ──────────────────────────────────────────────────────────────
   GCS
────────────────────────────────────────────────────────────── */
const storage = new Storage();

async function uploadToGcs({ bucketName, destPath, buffer, contentType = 'application/pdf' }) {
  if (!bucketName) throw new Error('GCS bucket name is required');
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(destPath);

  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: { cacheControl: 'public, max-age=31536000' },
  });

  return { bucket: bucketName, path: destPath };
}

/* ──────────────────────────────────────────────────────────────
   Upload middleware
────────────────────────────────────────────────────────────── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

export const uploadPdfMiddleware = upload.single('pdf');
export const uploadAttachmentMiddleware = upload.single('attachment');

async function removeFromGcs(bucketName, objectPath) {
  if (!bucketName || !objectPath) return;
  await storage.bucket(bucketName).file(objectPath).delete({ ignoreNotFound: true });
}

/* ──────────────────────────────────────────────────────────────
   Mobilized
────────────────────────────────────────────────────────────── */
export async function create(req, res) {
  try {
    const row = await api.createMobilized(req.body || {});
    return ok(res, row);
  } catch (err) {
    console.error('[mobilized][create] error', err);
    const status = /required|invalid|empty/i.test(err.message || '') ? 400 : 500;
    return fail(res, status, err.message || 'Failed to create mobilized');
  }
}

export async function getById(req, res) {
  try {
    const row = await api.getMobilizedById(req.params.id);
    if (!row) return fail(res, 404, 'mobilized not found');
    return ok(res, row);
  } catch (err) {
    console.error('[mobilized][getById] error', err);
    const status = /invalid/i.test(err.message || '') ? 400 : 500;
    return fail(res, status, err.message || 'Failed to fetch mobilized');
  }
}

export async function list(req, res) {
  try {
    const result = await api.listMobilized(req.query || {});
    return ok(res, result.rows, { total: result.total, limit: result.limit, offset: result.offset });
  } catch (err) {
    console.error('[mobilized][list] error', err);
    if (isPgMissingTable(err)) {
      return fail(res, 500, 'Database table not found (mobilized). Run the DDL migrations first.', { code: err.code });
    }
    return fail(res, 500, err.message || 'Failed to list mobilized');
  }
}

export async function update(req, res) {
  try {
    const row = await api.updateMobilized(req.params.id, req.body || {});
    if (!row) return fail(res, 404, 'mobilized not found');
    return ok(res, row);
  } catch (err) {
    console.error('[mobilized][update] error', err);
    const status = /invalid|empty|required/i.test(err.message || '') ? 400 : 500;
    return fail(res, status, err.message || 'Failed to update mobilized');
  }
}

export async function remove(req, res) {
  try {
    const out = await api.deleteMobilized(req.params.id);
    if (!out) return fail(res, 404, 'mobilized not found');
    return ok(res, out);
  } catch (err) {
    console.error('[mobilized][remove] error', err);
    const status = /invalid/i.test(err.message || '') ? 400 : 500;
    return fail(res, status, err.message || 'Failed to delete mobilized');
  }
}

/* ──────────────────────────────────────────────────────────────
   Mobilized Items
────────────────────────────────────────────────────────────── */
export async function listItems(req, res) {
  try {
    const rows = await api.listMobilizedItems(req.params.id);
    return ok(res, rows);
  } catch (err) {
    console.error('[mobilized][listItems] error', err);
    const status = /invalid/i.test(err.message || '') ? 400 : 500;
    return fail(res, status, err.message || 'Failed to list mobilized items');
  }
}

export async function addItem(req, res) {
  try {
    const row = await api.addMobilizedItem(req.params.id, req.body || {});
    return ok(res, row);
  } catch (err) {
    console.error('[mobilized][addItem] error', err);
    const status = /required|invalid|empty/i.test(err.message || '') ? 400 : 500;
    return fail(res, status, err.message || 'Failed to add mobilized item');
  }
}

export async function updateItem(req, res) {
  try {
    const row = await api.updateMobilizedItem(req.params.itemId, req.body || {});
    if (!row) return fail(res, 404, 'mobilized item not found');
    return ok(res, row);
  } catch (err) {
    console.error('[mobilized][updateItem] error', err);
    const status = /invalid|empty|required/i.test(err.message || '') ? 400 : 500;
    return fail(res, status, err.message || 'Failed to update mobilized item');
  }
}

export async function removeItem(req, res) {
  try {
    const out = await api.deleteMobilizedItem(req.params.itemId);
    if (!out) return fail(res, 404, 'mobilized item not found');
    return ok(res, out);
  } catch (err) {
    console.error('[mobilized][removeItem] error', err);
    const status = /invalid/i.test(err.message || '') ? 400 : 500;
    return fail(res, status, err.message || 'Failed to delete mobilized item');
  }
}

/* ──────────────────────────────────────────────────────────────
   Attachments (GCS)
────────────────────────────────────────────────────────────── */
export async function listAttachments(req, res) {
  try {
    const mob = await api.getMobilizedById(req.params.id);
    if (!mob) return fail(res, 404, 'mobilized not found');

    const rows = await api.listMobilizedAttachments(mob.mobilized_id);
    return ok(res, rows);
  } catch (err) {
    console.error('[mobilized][listAttachments] error', err);
    const status = /invalid/i.test(err.message || '') ? 400 : 500;
    return fail(res, status, err.message || 'Failed to list attachments');
  }
}

async function uploadAttachmentFor(req, res, mobilizedItemId = null) {
  let pendingAttachment = null;
  try {
    const mob = await api.getMobilizedById(req.params.id);
    if (!mob) return fail(res, 404, 'mobilized not found');

    if (mobilizedItemId !== null) {
      const item = await api.getMobilizedItemById(mobilizedItemId);
      if (!item || Number(item.mobilized_id) !== Number(mob.mobilized_id)) {
        return fail(res, 404, 'mobilized item not found');
      }
      mobilizedItemId = item.mobilized_item_id;
    }

    const file = req.file;
    if (!file) {
      return fail(res, 400, 'Attachment file is required (field name: attachment)');
    }

    const bucketName = getBucketName();
    const originalFilename = safeObjectName(file.originalname);
    const requestedType = String(req.body?.attachment_type || '').trim().toUpperCase();
    const attachmentType = requestedType || (
      String(file.mimetype || '').startsWith('image/') ? 'IMAGE' : 'FILE'
    );

    pendingAttachment = await api.createMobilizedAttachment({
      mobilized_id: mob.mobilized_id,
      mobilized_item_id: mobilizedItemId,
      attachment_type: attachmentType,
      original_filename: file.originalname || originalFilename,
      storage_filename: originalFilename,
      storage_provider: 'gcs',
      bucket_name: bucketName,
      object_path: '',
      mime_type: file.mimetype || 'application/octet-stream',
      size_bytes: file.size,
      sha256: sha256Hex(file.buffer),
      is_primary: false,
      status: 'UPLOADING',
    });

    const attachmentId = pendingAttachment.mobilized_attachment_id;
    const destPath = `mobilized/${mob.mobilized_id}/attachments/${attachmentId}/${originalFilename}`;

    await uploadToGcs({
      bucketName,
      destPath,
      buffer: file.buffer,
      contentType: file.mimetype || 'application/octet-stream',
    });

    const publicUrl = `${getPublicBase()}/${bucketName}/${destPath}`;
    let updated = await api.updateMobilizedAttachment(attachmentId, {
      object_path: destPath,
      public_url: publicUrl,
      status: 'ACTIVE',
    });

    if (/^(true|1|yes)$/i.test(String(req.body?.is_primary || ''))) {
      updated = await api.setPrimaryMobilizedAttachment(
        mob.mobilized_id,
        attachmentId
      );
    }

    return ok(res, updated);
  } catch (err) {
    if (pendingAttachment?.mobilized_attachment_id) {
      try {
        await api.deleteMobilizedAttachment(
          pendingAttachment.mobilized_id,
          pendingAttachment.mobilized_attachment_id
        );
      } catch (cleanupErr) {
        console.error('[mobilized][uploadAttachment] cleanup error', cleanupErr);
      }
    }
    console.error('[mobilized][uploadAttachment] error', err);
    const status = /invalid|required|too large|unexpected field/i.test(err.message || '') ? 400 : 500;
    return fail(res, status, err.message || 'Failed to upload attachment');
  }
}

export async function uploadAttachment(req, res) {
  return uploadAttachmentFor(req, res);
}

export async function uploadItemAttachment(req, res) {
  return uploadAttachmentFor(req, res, req.params.itemId);
}

export async function setPrimaryAttachment(req, res) {
  try {
    const row = await api.setPrimaryMobilizedAttachment(
      req.params.id,
      req.params.attachmentId
    );
    if (!row) return fail(res, 404, 'active mobilized attachment not found');
    return ok(res, row);
  } catch (err) {
    console.error('[mobilized][setPrimaryAttachment] error', err);
    const status = /invalid/i.test(err.message || '') ? 400 : 500;
    return fail(res, status, err.message || 'Failed to set primary attachment');
  }
}

export async function removeAttachment(req, res) {
  try {
    const attachment = await api.getMobilizedAttachmentById(req.params.attachmentId);
    if (
      !attachment ||
      Number(attachment.mobilized_id) !== Number(req.params.id)
    ) {
      return fail(res, 404, 'mobilized attachment not found');
    }

    await removeFromGcs(attachment.bucket_name, attachment.object_path);
    const deleted = await api.deleteMobilizedAttachment(
      req.params.id,
      req.params.attachmentId
    );
    return ok(res, {
      mobilized_attachment_id: deleted.mobilized_attachment_id,
    });
  } catch (err) {
    console.error('[mobilized][removeAttachment] error', err);
    const status = /invalid/i.test(err.message || '') ? 400 : 500;
    return fail(res, status, err.message || 'Failed to delete attachment');
  }
}

/* ──────────────────────────────────────────────────────────────
   PDF — Upload (GCS)
   POST /api/mobilized/:id/pdf/upload (multipart/form-data, field: pdf)
────────────────────────────────────────────────────────────── */
export async function uploadPdf(req, res) {
  try {
    const mobilizedId = req.params.id;

    const mob = await api.getMobilizedById(mobilizedId);
    if (!mob) return fail(res, 404, 'mobilized not found');

    const file = req.file;
    if (!file) return fail(res, 400, 'PDF file is required (field name: pdf)');

    const isPdf =
      (file.mimetype || '').toLowerCase().includes('pdf') ||
      /\.pdf$/i.test(file.originalname || '');

    if (!isPdf) return fail(res, 400, 'Invalid file type. Only PDF is allowed.');

    const bucket = getBucketName();
    const publicBase = getPublicBase();

    const sha = sha256Hex(file.buffer);

    const nextVersion = (Number(mob.pdf_version || 1) || 1) + 1;
    const destPath = `mobilized/${mob.mobilized_id}/v${nextVersion}.pdf`;

    await uploadToGcs({
      bucketName: bucket,
      destPath,
      buffer: file.buffer,
      contentType: file.mimetype || 'application/pdf',
    });

    const publicUrl = `${publicBase}/${bucket}/${destPath}`;

    const updated = await api.updateMobilized(mob.mobilized_id, {
      pdf_storage: 'gcs',
      pdf_path: publicUrl,
      pdf_filename: file.originalname,
      pdf_mime: file.mimetype || 'application/pdf',
      pdf_size_bytes: file.size,
      pdf_sha256: sha,
      pdf_uploaded_at: new Date(),
      pdf_version: nextVersion,
    });

    return ok(res, updated);
  } catch (err) {
    console.error('[mobilized][uploadPdf] error', err);
    return fail(res, 500, err.message || 'Failed to upload PDF to GCS');
  }
}

/* ──────────────────────────────────────────────────────────────
   PDF — Generate and Download
   GET /api/mobilized/:id/pdf
────────────────────────────────────────────────────────────── */
export async function downloadPdf(req, res) {
  try {
    const mobilizedId = req.params.id;

    const mob = await api.getMobilizedById(mobilizedId);
    if (!mob) return fail(res, 404, 'mobilized not found');

    const items = await loadItemsWithAttachments(mobilizedId);

    const apiBaseUrl =
      process.env.API_BASE_URL ||
      `${req.protocol}://${req.get('host')}`;

    const company = mob?.company || null;

    const pdfBuffer = await generateMobilizedPdf({
      mobilized: mob,
      items,
      company,
      apiBase: apiBaseUrl,
    });

    const filename = `mobilized_${mob.mobilized_id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.end(pdfBuffer);
  } catch (err) {
    console.error('[mobilized][downloadPdf] error', err);
    return fail(res, 500, err.message || 'Failed to generate PDF');
  }
}

/* ──────────────────────────────────────────────────────────────
   PDF — Generate + Upload to GCS + Update metadata
   POST /api/mobilized/:id/pdf/generate-upload
────────────────────────────────────────────────────────────── */
export async function generateAndUploadPdf(req, res) {
  try {
    const mobilizedId = req.params.id;

    const mob = await api.getMobilizedById(mobilizedId);
    if (!mob) return fail(res, 404, 'mobilized not found');

    const items = await api.listMobilizedItems(mobilizedId);

    const apiBaseUrl =
      process.env.API_BASE_URL ||
      `${req.protocol}://${req.get('host')}`;

    const company = mob?.company || null;

    const pdfBuffer = await generateMobilizedPdf({
      mobilized: mob,
      items,
      company,
      apiBase: apiBaseUrl,
    });

    const bucket = getBucketName();
    const publicBase = getPublicBase();

    const sha = sha256Hex(pdfBuffer);
    const nextVersion = (Number(mob.pdf_version || 1) || 1) + 1;
    const destPath = `mobilized/${mob.mobilized_id}/v${nextVersion}.pdf`;

    await uploadToGcs({
      bucketName: bucket,
      destPath,
      buffer: pdfBuffer,
      contentType: 'application/pdf',
    });

    const publicUrl = `${publicBase}/${bucket}/${destPath}`;

    const updated = await api.updateMobilized(mob.mobilized_id, {
      pdf_storage: 'gcs',
      pdf_path: publicUrl,
      pdf_filename: `mobilized_${mob.mobilized_id}_v${nextVersion}.pdf`,
      pdf_mime: 'application/pdf',
      pdf_size_bytes: pdfBuffer.length,
      pdf_sha256: sha,
      pdf_uploaded_at: new Date(),
      pdf_version: nextVersion,
    });

    return ok(res, updated);
  } catch (err) {
    console.error('[mobilized][generateAndUploadPdf] error', err);
    return fail(res, 500, err.message || 'Failed to generate and upload PDF');
  }
}

/* ──────────────────────────────────────────────────────────────
   PDF — Download ALL mobilized (batch)
   GET /api/mobilized/pdf/all?q=...&status=...
────────────────────────────────────────────────────────────── */
export async function downloadAllPdf(req, res) {
  try {
    const apiBaseUrl =
      process.env.API_BASE_URL ||
      `${req.protocol}://${req.get('host')}`;

    // We want "all" respecting filters:
    const q = req.query?.q || '';
    const status = req.query?.status || '';
    const source_system = req.query?.source_system || '';
    const external_ref = req.query?.external_ref || '';
    const from = req.query?.from || '';
    const to = req.query?.to || '';

    // paginate internally to fetch all
    const limit = 200;
    let offset = 0;
    let all = [];

    while (true) {
      const out = await api.listMobilized({
        q,
        status,
        source_system,
        external_ref,
        from,
        to,
        limit,
        offset,
        orderBy: 'mobilized_id desc',
      });

      const rows = out?.rows || [];
      all = all.concat(rows);

      if (rows.length < limit) break;
      offset += limit;

      // safety cap
      if (all.length > 5000) break;
    }

    // load items for each mobilized
    const mobilizedList = [];
    for (const mob of all) {
      const items = await loadItemsWithAttachments(
        mob.mobilized_id
      );

      mobilizedList.push({
        ...mob,
        items,
      });
    }

    const pdfBuffer = await generateMobilizedAllPdf({
      mobilizedList,
      title: 'Mobilized — Inventário (Todos)',
      apiBase: apiBaseUrl,
    });

    const filename = `mobilized_inventario_todos_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.end(pdfBuffer);
  } catch (err) {
    console.error('[mobilized][downloadAllPdf] error', err);
    return res.status(500).json({ ok: false, message: err.message || 'Failed to generate ALL PDF' });
  }
}

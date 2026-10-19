// ╔══════════════════════════════════════════════════════════════════════╗
// ║ uploadBucketsTransporters.js                                        ║
// ║ Google Cloud Storage — anexos de Transportadoras                    ║
// ║ Só bucket — os registros ficam em repositories/transporters/        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import path from 'node:path';
import { Storage } from '@google-cloud/storage';

const BUCKET_NAME =
  process.env.GCS_BUCKET ||
  process.env.GOOGLE_CLOUD_BUCKET ||
  process.env.STORAGE_BUCKET ||
  'erp-infinity-00000';

const SIGNED_URL_TTL_MS = 24 * 60 * 60 * 1000;

const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

// ──────────────────────────────────────────────────────────────────────
// Nomes e caminhos
// ──────────────────────────────────────────────────────────────────────

function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
    .toUpperCase();
}

function sanitizeFileName(fileName = 'attachment') {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);

  const cleanBase = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);

  const cleanExt = ext
    .replace(/[^a-zA-Z0-9.]/g, '')
    .slice(0, 20);

  return `${cleanBase || 'attachment'}${cleanExt}`;
}

function getTransporterFolderName(transporter) {
  return slugify(
    transporter.trade_name ||
    transporter.legal_name ||
    `TRANSPORTER-${transporter.transporter_id}`
  );
}

export function makeStoragePath(transporter, originalName) {
  const folderName = getTransporterFolderName(transporter);
  const safeName = sanitizeFileName(originalName);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  return `transporters/${folderName}/attachments/${stamp}_${safeName}`;
}

// ──────────────────────────────────────────────────────────────────────
// Operações no bucket
// ──────────────────────────────────────────────────────────────────────

export async function saveTransporterFile({ filePath, buffer, mimeType, transporterId, originalName }) {
  await bucket.file(filePath).save(buffer, {
    resumable: false,
    metadata: {
      contentType: mimeType,
      metadata: {
        transporter_id: String(transporterId),
        original_name: encodeURIComponent(originalName)
      }
    }
  });
}

export async function safeGetSignedUrl(filePath) {
  if (!filePath) return null;

  try {
    const [url] = await bucket.file(filePath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + SIGNED_URL_TTL_MS
    });

    return url;
  } catch (err) {
    console.warn(
      `[uploadBucketsTransporters] Não foi possível gerar signed URL para "${filePath}": ${err.message}`
    );
    return null;
  }
}

export async function safeDeleteFromBucket(filePath) {
  if (!filePath) return;

  try {
    await bucket.file(filePath).delete({ ignoreNotFound: true });
  } catch (err) {
    console.warn(
      `[uploadBucketsTransporters] Falha ao remover "${filePath}" do bucket: ${err.message}`
    );
  }
}

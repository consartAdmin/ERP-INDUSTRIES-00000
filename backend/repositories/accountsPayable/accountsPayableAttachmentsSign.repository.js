// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsPayableAttachmentsSign.repository.js — URLs assinadas GCS  ║
// ║ signAttachmentUpload (PUT) / signAttachmentDownload (GET)          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { toNumber } from './accountsPayable.utils.js';
import { normalizeAttachmentType, toStrOrNull, safeFileName } from './accountsPayable.sanitizers.js';
import {
  storage,
  ensureAccountsPayableBucket,
  getSignedUrlTtl,
  assertAccountsPayableObjectPath,
  buildAccountsPayableObjectPath,
} from './accountsPayable.storage.js';
import { getById } from './accountsPayableQuery.repository.js';
import { getAttachmentById } from './accountsPayableAttachments.repository.js';

export async function signAttachmentUpload(input = {}) {
  const accountPayableId = Number(input.account_payable_id);
  const fileName = safeFileName(input.file_name);
  const fileType = normalizeAttachmentType(input.file_type);
  const mimeType = toStrOrNull(input.mime_type) || 'application/octet-stream';

  if (!Number.isInteger(accountPayableId) || accountPayableId <= 0) {
    const error = new Error('account_payable_id is required');
    error.code = 'VALIDATION';
    throw error;
  }

  const payable = await getById(accountPayableId);
  if (!payable) {
    const error = new Error('Conta a pagar não encontrada');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const gcsBucket = ensureAccountsPayableBucket();
  const gcsPath = buildAccountsPayableObjectPath({
    account_payable_id: accountPayableId,
    file_type: fileType,
    file_name: fileName
  });

  const expiresInSec = getSignedUrlTtl();
  const file = storage.bucket(gcsBucket).file(gcsPath);
  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + expiresInSec * 1000,
    contentType: mimeType
  });

  return {
    ok: true,
    signedUrl,
    method: 'PUT',
    expiresInSec,
    headers: { 'Content-Type': mimeType },
    meta: {
      account_payable_id: accountPayableId,
      file_type: fileType,
      file_name: fileName,
      mime_type: mimeType,
      file_size: Math.max(0, toNumber(input.file_size, 0)),
      gcs_bucket: gcsBucket,
      gcs_path: gcsPath
    }
  };
}

export async function signAttachmentDownload(
  attachmentId,
  { expiresInSec = getSignedUrlTtl() } = {}
) {
  const attachment = await getAttachmentById(attachmentId);

  if (!attachment || attachment.is_active === false) {
    const error = new Error('Anexo não encontrado');
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (!attachment.gcs_bucket || !attachment.gcs_path) {
    if (!attachment.file_url) {
      const error = new Error('Anexo sem localização válida');
      error.code = 'NOT_FOUND';
      throw error;
    }

    return {
      ok: true,
      signedUrl: attachment.file_url,
      method: 'GET',
      expiresInSec: null,
      legacy: true
    };
  }

  const expectedBucket = ensureAccountsPayableBucket();
  if (attachment.gcs_bucket !== expectedBucket) {
    const error = new Error('Bucket do anexo inválido');
    error.code = 'VALIDATION';
    throw error;
  }

  const gcsPath = assertAccountsPayableObjectPath(attachment.gcs_path);
  const ttl = Number(expiresInSec) > 0 ? Number(expiresInSec) : getSignedUrlTtl();
  const file = storage.bucket(expectedBucket).file(gcsPath);
  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + ttl * 1000,
    responseDisposition: `inline; filename="${safeFileName(attachment.file_name)}"`
  });

  return { ok: true, signedUrl, method: 'GET', expiresInSec: ttl, legacy: false };
}

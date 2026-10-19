// ╔════════════════════════════════════════════════════════════════════╗
// ║ transportersAttachments.repository.js                              ║
// ║ Tabela: public."transportersAttachments"                           ║
// ║ O arquivo em si fica em uploadBuckets/uploadBucketsTransporters.js ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_ATTACHMENTS, ATTACHMENT_COLUMNS } from './transporters.constants.js';
import {
  httpError,
  validateTransporterId,
  validateAttachmentId,
} from './transporters.utils.js';
import {
  makeStoragePath,
  saveTransporterFile,
  safeGetSignedUrl,
  safeDeleteFromBucket,
} from '../../uploadBuckets/uploadBucketsTransporters.js';
import { fixUploadedFileName } from '../../uploadBuckets/uploadBucketsCustomers.js';

async function getTransporterOrFail(transporterId) {
  const { rows } = await pool.query(
    `
      SELECT
        transporter_id,
        legal_name,
        trade_name
      FROM ${TB}
      WHERE transporter_id = $1
      LIMIT 1
    `,
    [transporterId]
  );

  const transporter = rows[0];

  if (!transporter) {
    throw httpError('Transporter not found.', 404);
  }

  return transporter;
}

/**
 * LIST — anexos ativos com signed URL
 */
export async function list(transporterIdParam) {
  const transporterId = validateTransporterId(transporterIdParam);
  await getTransporterOrFail(transporterId);

  const { rows } = await pool.query(
    `
      SELECT ${ATTACHMENT_COLUMNS}
      FROM ${TB_ATTACHMENTS}
      WHERE transporter_id = $1
        AND COALESCE(is_active, true) = true
      ORDER BY created_at DESC, attachment_id DESC
    `,
    [transporterId]
  );

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      signed_url: await safeGetSignedUrl(row.file_path)
    }))
  );
}

/**
 * UPLOAD — grava no bucket e depois registra no banco
 */
export async function upload(transporterIdParam, file) {
  const transporterId = validateTransporterId(transporterIdParam);

  if (!file || !file.buffer) {
    throw httpError('No file received.', 400);
  }

  const transporter = await getTransporterOrFail(transporterId);

  // multer entrega o nome em latin1; converte para UTF-8 (ex.: "Sem tÃ­tulo" → "Sem título")
  const originalName = fixUploadedFileName(file.originalname || 'attachment');
  const mimeType = file.mimetype || 'application/octet-stream';
  const sizeBytes = file.size || file.buffer.length || null;
  const filePath = makeStoragePath(transporter, originalName);

  await saveTransporterFile({
    filePath,
    buffer: file.buffer,
    mimeType,
    transporterId,
    originalName,
  });

  const signedUrl = await safeGetSignedUrl(filePath);

  try {
    const { rows } = await pool.query(
      `
        INSERT INTO ${TB_ATTACHMENTS}
        (
          transporter_id,
          file_name,
          file_path,
          file_url,
          mime_type,
          size_bytes,
          is_active
        )
        VALUES
        (
          $1, $2, $3, $4, $5, $6, true
        )
        RETURNING ${ATTACHMENT_COLUMNS}
      `,
      [
        transporterId,
        originalName,
        filePath,
        signedUrl,
        mimeType,
        sizeBytes
      ]
    );

    return {
      ...rows[0],
      signed_url: signedUrl
    };
  } catch (err) {
    // Evita arquivo órfão no bucket se o INSERT falhar
    await safeDeleteFromBucket(filePath);
    throw err;
  }
}

/**
 * REMOVE — desativa no banco e só então apaga do bucket
 */
export async function remove(transporterIdParam, attachmentIdParam) {
  const transporterId = validateTransporterId(transporterIdParam);
  const attachmentId = validateAttachmentId(attachmentIdParam);

  const { rows } = await pool.query(
    `
      UPDATE ${TB_ATTACHMENTS}
      SET is_active = false
      WHERE attachment_id = $1
        AND transporter_id = $2
        AND COALESCE(is_active, true) = true
      RETURNING attachment_id, file_path
    `,
    [attachmentId, transporterId]
  );

  const attachment = rows[0];

  if (!attachment) {
    return false;
  }

  await safeDeleteFromBucket(attachment.file_path);

  return true;
}

export default {
  list,
  upload,
  remove,
};

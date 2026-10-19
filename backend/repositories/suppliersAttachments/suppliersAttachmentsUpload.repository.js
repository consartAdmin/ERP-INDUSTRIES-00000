// ╔════════════════════════════════════════════════════════════════════╗
// ║ suppliersAttachmentsUpload.repository.js — upload (GCS + INSERT)   ║
// ║ Tabela: public."suppliersAttachments"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ATTACHMENTS_TABLE } from './suppliersAttachments.constants.js';
import { validateSupplierId } from './suppliersAttachments.sanitizers.js';
import { bucket, getSignedUrl } from './suppliersAttachmentsStorage.repository.js';
import { ensureSupplierExists, makeStoragePath } from './suppliersAttachmentsSupplier.repository.js';

export async function upload(supplierIdParam, file) {
  const supplierId = validateSupplierId(supplierIdParam);
  await ensureSupplierExists(supplierId);

  if (!file || !file.buffer) {
    throw new Error('No file received.');
  }

  const originalName = file.originalname || 'attachment';
  const filePath = await makeStoragePath(supplierId, originalName);
  const gcsFile = bucket.file(filePath);

  await gcsFile.save(file.buffer, {
    resumable: false,
    metadata: {
      contentType: file.mimetype || 'application/octet-stream',
      metadata: {
        supplier_id: String(supplierId),
        original_name: originalName
      }
    }
  });

  const signedUrl = await getSignedUrl(filePath).catch(() => null);

  const { rows } = await pool.query(
    `
      INSERT INTO ${ATTACHMENTS_TABLE}
      (
        supplier_id,
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
      RETURNING
        attachment_id,
        supplier_id,
        file_name,
        file_path,
        file_url,
        mime_type,
        size_bytes,
        created_at,
        is_active
    `,
    [
      supplierId,
      originalName,
      filePath,
      signedUrl,
      file.mimetype || null,
      file.size || file.buffer.length || null
    ]
  );

  return {
    ...rows[0],
    signed_url: signedUrl
  };
}

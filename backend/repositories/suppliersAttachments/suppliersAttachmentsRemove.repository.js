// ╔════════════════════════════════════════════════════════════════════╗
// ║ suppliersAttachmentsRemove.repository.js — remove (GCS + soft del) ║
// ║ Tabela: public."suppliersAttachments"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ATTACHMENTS_TABLE } from './suppliersAttachments.constants.js';
import { validateSupplierId, validateAttachmentId } from './suppliersAttachments.sanitizers.js';
import { bucket } from './suppliersAttachmentsStorage.repository.js';

export async function remove(supplierIdParam, attachmentIdParam) {
  const supplierId = validateSupplierId(supplierIdParam);
  const attachmentId = validateAttachmentId(attachmentIdParam);

  const { rows } = await pool.query(
    `
      SELECT
        attachment_id,
        file_path
      FROM ${ATTACHMENTS_TABLE}
      WHERE attachment_id = $1
        AND supplier_id = $2
        AND COALESCE(is_active, true) = true
      LIMIT 1
    `,
    [attachmentId, supplierId]
  );

  const attachment = rows[0];

  if (!attachment) {
    return false;
  }

  if (attachment.file_path) {
    await bucket.file(attachment.file_path).delete({
      ignoreNotFound: true
    });
  }

  const { rowCount } = await pool.query(
    `
      UPDATE ${ATTACHMENTS_TABLE}
      SET is_active = false
      WHERE attachment_id = $1
        AND supplier_id = $2
    `,
    [attachmentId, supplierId]
  );

  return rowCount > 0;
}

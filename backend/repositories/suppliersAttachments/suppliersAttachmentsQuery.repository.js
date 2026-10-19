// ╔════════════════════════════════════════════════════════════════════╗
// ║ suppliersAttachmentsQuery.repository.js — list (com signed_url)    ║
// ║ Tabela: public."suppliersAttachments"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ATTACHMENTS_TABLE } from './suppliersAttachments.constants.js';
import { validateSupplierId } from './suppliersAttachments.sanitizers.js';
import { getSignedUrl } from './suppliersAttachmentsStorage.repository.js';
import { ensureSupplierExists } from './suppliersAttachmentsSupplier.repository.js';

export async function list(supplierIdParam) {
  const supplierId = validateSupplierId(supplierIdParam);
  await ensureSupplierExists(supplierId);

  const { rows } = await pool.query(
    `
      SELECT
        attachment_id,
        supplier_id,
        file_name,
        file_path,
        file_url,
        mime_type,
        size_bytes,
        created_at,
        is_active
      FROM ${ATTACHMENTS_TABLE}
      WHERE supplier_id = $1
        AND COALESCE(is_active, true) = true
      ORDER BY created_at DESC, attachment_id DESC
    `,
    [supplierId]
  );

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      signed_url: await getSignedUrl(row.file_path).catch(() => null)
    }))
  );
}

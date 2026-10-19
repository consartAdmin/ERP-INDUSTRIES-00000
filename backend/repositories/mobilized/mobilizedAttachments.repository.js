// ╔════════════════════════════════════════════════════════════════════╗
// ║ mobilizedAttachments.repository.js — Anexos do imobilizado         ║
// ║ Tabela: public."mobilizedAttachments"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_A } from './mobilized.constants.js';
import { asInt, asNumericStr, safeStr } from './mobilized.sanitizers.js';
import { q } from './mobilized.utils.js';

/* ──────────────────────────────────────────────────────────────
   Mobilized Attachments
────────────────────────────────────────────────────────────── */
export async function listMobilizedAttachments(mobilized_id) {
  const id = asInt(mobilized_id);
  if (!id) throw new Error('invalid mobilized_id');

  const res = await q(
    `SELECT *
       FROM ${TB_A}
      WHERE mobilized_id = $1
        AND status <> 'DELETED'
      ORDER BY is_primary DESC, mobilized_attachment_id ASC`,
    [id]
  );
  return res.rows;
}

export async function getMobilizedAttachmentById(mobilized_attachment_id) {
  const id = asInt(mobilized_attachment_id);
  if (!id) throw new Error('invalid mobilized_attachment_id');

  const res = await q(
    `SELECT * FROM ${TB_A} WHERE mobilized_attachment_id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function createMobilizedAttachment(data = {}) {
  const mobilizedId = asInt(data.mobilized_id);
  if (!mobilizedId) throw new Error('invalid mobilized_id');

  const itemId = data.mobilized_item_id == null
    ? null
    : asInt(data.mobilized_item_id);
  if (data.mobilized_item_id != null && !itemId) {
    throw new Error('invalid mobilized_item_id');
  }

  const originalFilename = safeStr(data.original_filename, 255);
  if (!originalFilename) throw new Error('original_filename is required');

  const res = await q(
    `INSERT INTO ${TB_A} (
       mobilized_id, mobilized_item_id, attachment_type,
       original_filename, storage_filename,
       storage_provider, bucket_name, object_path, public_url,
       mime_type, size_bytes, sha256, is_primary, status,
       created_at, updated_at
     ) VALUES (
       $1,$2,$3,
       $4,$5,
       $6,$7,$8,$9,
       $10,$11,$12,$13,$14,
       NOW(),NOW()
     )
     RETURNING *`,
    [
      mobilizedId,
      itemId,
      safeStr(data.attachment_type || 'FILE', 30).toUpperCase(),
      originalFilename,
      safeStr(data.storage_filename || originalFilename, 255),
      safeStr(data.storage_provider || 'gcs', 30),
      safeStr(data.bucket_name, 255),
      String(data.object_path || ''),
      data.public_url ? String(data.public_url) : null,
      safeStr(data.mime_type || 'application/octet-stream', 120),
      data.size_bytes == null ? null : asNumericStr(data.size_bytes),
      safeStr(data.sha256, 64) || null,
      Boolean(data.is_primary),
      safeStr(data.status || 'UPLOADING', 20).toUpperCase(),
    ]
  );
  return res.rows[0];
}

export async function updateMobilizedAttachment(mobilized_attachment_id, patch = {}) {
  const id = asInt(mobilized_attachment_id);
  if (!id) throw new Error('invalid mobilized_attachment_id');

  const set = [];
  const params = [];
  const add = (column, value) => {
    params.push(value);
    set.push(`${column} = $${params.length}`);
  };

  if (patch.storage_filename !== undefined) add('storage_filename', safeStr(patch.storage_filename, 255));
  if (patch.bucket_name !== undefined) add('bucket_name', safeStr(patch.bucket_name, 255));
  if (patch.object_path !== undefined) add('object_path', String(patch.object_path || ''));
  if (patch.public_url !== undefined) add('public_url', patch.public_url ? String(patch.public_url) : null);
  if (patch.mime_type !== undefined) add('mime_type', safeStr(patch.mime_type, 120));
  if (patch.size_bytes !== undefined) add('size_bytes', patch.size_bytes == null ? null : asNumericStr(patch.size_bytes));
  if (patch.sha256 !== undefined) add('sha256', safeStr(patch.sha256, 64) || null);
  if (patch.status !== undefined) add('status', safeStr(patch.status, 20).toUpperCase());

  if (!set.length) return getMobilizedAttachmentById(id);
  params.push(id);

  const res = await q(
    `UPDATE ${TB_A}
        SET ${set.join(', ')}, updated_at = NOW()
      WHERE mobilized_attachment_id = $${params.length}
      RETURNING *`,
    params
  );
  return res.rows[0] || null;
}

export async function setPrimaryMobilizedAttachment(mobilized_id, attachment_id) {
  const mobilizedId = asInt(mobilized_id);
  const attachmentId = asInt(attachment_id);
  if (!mobilizedId) throw new Error('invalid mobilized_id');
  if (!attachmentId) throw new Error('invalid mobilized_attachment_id');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const target = await client.query(
      `SELECT * FROM ${TB_A}
        WHERE mobilized_attachment_id = $1
          AND mobilized_id = $2
          AND status = 'ACTIVE'
        FOR UPDATE`,
      [attachmentId, mobilizedId]
    );
    if (!target.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    const itemId = target.rows[0].mobilized_item_id;
    await client.query(
      `UPDATE ${TB_A}
          SET is_primary = false, updated_at = NOW()
        WHERE mobilized_id = $1
          AND mobilized_item_id IS NOT DISTINCT FROM $2
          AND is_primary = true`,
      [mobilizedId, itemId]
    );
    const updated = await client.query(
      `UPDATE ${TB_A}
          SET is_primary = true, updated_at = NOW()
        WHERE mobilized_attachment_id = $1
        RETURNING *`,
      [attachmentId]
    );
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteMobilizedAttachment(mobilized_id, attachment_id) {
  const mobilizedId = asInt(mobilized_id);
  const attachmentId = asInt(attachment_id);
  if (!mobilizedId) throw new Error('invalid mobilized_id');
  if (!attachmentId) throw new Error('invalid mobilized_attachment_id');

  const res = await q(
    `DELETE FROM ${TB_A}
      WHERE mobilized_attachment_id = $1
        AND mobilized_id = $2
      RETURNING *`,
    [attachmentId, mobilizedId]
  );
  return res.rows[0] || null;
}

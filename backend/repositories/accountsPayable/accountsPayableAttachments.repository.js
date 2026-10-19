// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsPayableAttachments.repository.js — listAttachments /       ║
// ║ getAttachmentById / addAttachment(s) / removeAttachment            ║
// ║ Tabela: public."accountsPayableAttachments"                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ATTACH } from './accountsPayable.constants.js';
import { q, toNumber } from './accountsPayable.utils.js';
import { normalizeAttachmentType, toStrOrNull, safeFileName } from './accountsPayable.sanitizers.js';
import {
  storage,
  ensureAccountsPayableBucket,
  assertAccountsPayableObjectPath,
} from './accountsPayable.storage.js';

export async function listAttachments(accountPayableId) {
  const sql = `
    SELECT
      id,
      account_payable_id,
      file_type,
      file_name,
      file_url,
      mime_type,
      file_size,
      gcs_bucket,
      gcs_path,
      is_active,
      created_at,
      updated_at
    FROM ${TB_ATTACH}
    WHERE account_payable_id = $1
      AND is_active = TRUE
    ORDER BY id ASC
  `;

  const res = await q(sql, [accountPayableId]);
  return res.rows;
}

export async function getAttachmentById(attachmentId) {
  const sql = `
    SELECT
      id,
      account_payable_id,
      file_type,
      file_name,
      file_url,
      mime_type,
      file_size,
      gcs_bucket,
      gcs_path,
      is_active,
      created_at,
      updated_at
    FROM ${TB_ATTACH}
    WHERE id = $1
    LIMIT 1
  `;

  const res = await q(sql, [attachmentId]);
  return res.rows[0] || null;
}

export async function addAttachment(accountPayableId, input = {}, client = null) {
  const accountId = Number(accountPayableId);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new Error('accountPayableId is required');
  }

  const fileUrl = toStrOrNull(input.file_url);
  const hasGcsObject = !!(input.gcs_bucket || input.gcs_path);
  let gcsBucket = null;
  let gcsPath = null;

  if (hasGcsObject) {
    gcsBucket = ensureAccountsPayableBucket();
    if (toStrOrNull(input.gcs_bucket) !== gcsBucket) {
      const error = new Error('gcs_bucket inválido');
      error.code = 'VALIDATION';
      throw error;
    }

    gcsPath = assertAccountsPayableObjectPath(input.gcs_path);
    const gcsFile = storage.bucket(gcsBucket).file(gcsPath);
    const [exists] = await gcsFile.exists();
    if (!exists) {
      const error = new Error('O arquivo ainda não existe no Cloud Storage');
      error.code = 'NOT_FOUND';
      throw error;
    }
  } else if (!fileUrl) {
    throw new Error('gcs_path or file_url is required');
  }

  const db = client || pool;

  if (!hasGcsObject) {
    const legacySql = `
      INSERT INTO ${TB_ATTACH} (
        account_payable_id,
        file_type,
        file_name,
        file_url,
        mime_type,
        file_size,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
      ON CONFLICT (account_payable_id, file_type, file_url)
      DO UPDATE SET
        file_name = EXCLUDED.file_name,
        mime_type = EXCLUDED.mime_type,
        file_size = EXCLUDED.file_size,
        is_active = TRUE,
        updated_at = NOW()
      RETURNING *
    `;

    const legacyRes = await db.query(legacySql, [
      accountId,
      normalizeAttachmentType(input.file_type),
      toStrOrNull(input.file_name),
      fileUrl,
      toStrOrNull(input.mime_type),
      Math.max(0, toNumber(input.file_size, 0))
    ]);

    return legacyRes.rows[0] || null;
  }

  const sql = `
    INSERT INTO ${TB_ATTACH} (
      account_payable_id,
      file_type,
      file_name,
      file_url,
      mime_type,
      file_size,
      gcs_bucket,
      gcs_path,
      is_active,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, TRUE, NOW(), NOW())
    ON CONFLICT (gcs_bucket, gcs_path)
      WHERE gcs_bucket IS NOT NULL AND gcs_path IS NOT NULL
    DO UPDATE SET
      account_payable_id = EXCLUDED.account_payable_id,
      file_type = EXCLUDED.file_type,
      file_name = EXCLUDED.file_name,
      mime_type = EXCLUDED.mime_type,
      file_size = EXCLUDED.file_size,
      is_active = TRUE,
      updated_at = NOW()
    RETURNING *
  `;

  const res = await db.query(sql, [
    accountId,
    normalizeAttachmentType(input.file_type),
    safeFileName(input.file_name),
    toStrOrNull(input.mime_type) || 'application/octet-stream',
    Math.max(0, toNumber(input.file_size, 0)),
    gcsBucket,
    gcsPath
  ]);

  return res.rows[0] || null;
}

export async function addAttachments(accountPayableId, attachments = [], client = null) {
  const out = [];

  for (const att of attachments) {
    if (!att?.file_url && !att?.gcs_path) continue;
    const row = await addAttachment(accountPayableId, att, client);
    if (row) out.push(row);
  }

  return out;
}

export async function removeAttachment(attachmentId) {
  const sql = `
    UPDATE ${TB_ATTACH}
    SET is_active = FALSE, updated_at = NOW()
    WHERE id = $1
  `;
  const res = await q(sql, [attachmentId]);
  return res.rowCount > 0;
}

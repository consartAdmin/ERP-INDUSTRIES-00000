// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashMovimentsAttachments.repository.js — anexos + cópia de         ║
// ║ anexos do Contas a Pagar para o GCS                                ║
// ║ Tabela: "cashMovimentsAttachments"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import fs from 'node:fs';
import { Storage } from '@google-cloud/storage';
import { BUCKET_NAME, PROJECT_ID } from './cashMoviments.constants.js';
import { q, buildCaixaObjectPath, resolvePublicFile } from './cashMoviments.utils.js';

const storage = new Storage(PROJECT_ID ? { projectId: PROJECT_ID } : undefined);

/* =========================================================================
   ANEXOS
============================================================================*/

export async function listAnexos({ movimentacao_id, cash_movement_id }) {
  const finalMovementId = cash_movement_id ?? movimentacao_id;

  const res = await q(
    `
    SELECT
      id,
      cash_movement_id,
      cash_movement_id AS movimentacao_id,
      file_name,
      file_name AS filename,
      mime_type,
      file_size_bytes,
      file_size_bytes AS size_bytes,
      storage_bucket,
      storage_bucket AS gcs_bucket,
      storage_path,
      storage_path AS gcs_path,
      created_at
    FROM "cashMovimentsAttachments"
    WHERE cash_movement_id = $1
    ORDER BY created_at DESC
    `,
    [Number(finalMovementId)]
  );

  return res.rows;
}

export async function addAnexo({
  movimentacao_id,
  cash_movement_id,
  filename,
  file_name,
  mime_type,
  size_bytes,
  file_size_bytes,
  gcs_bucket,
  storage_bucket,
  gcs_path,
  storage_path,
}) {
  const finalMovementId = cash_movement_id ?? movimentacao_id;
  const finalFileName = file_name ?? filename;
  const finalSize = file_size_bytes ?? size_bytes;
  const finalBucket = storage_bucket ?? gcs_bucket;
  const finalPath = storage_path ?? gcs_path;

  const res = await q(
    `
    INSERT INTO "cashMovimentsAttachments"
    (
      cash_movement_id,
      file_name,
      mime_type,
      file_size_bytes,
      storage_bucket,
      storage_path
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      cash_movement_id,
      cash_movement_id AS movimentacao_id,
      file_name,
      file_name AS filename,
      mime_type,
      file_size_bytes,
      file_size_bytes AS size_bytes,
      storage_bucket,
      storage_bucket AS gcs_bucket,
      storage_path,
      storage_path AS gcs_path,
      created_at
    `,
    [
      Number(finalMovementId),
      finalFileName,
      mime_type,
      finalSize,
      finalBucket,
      finalPath,
    ]
  );

  return res.rows[0];
}

export async function deleteAnexo(id) {
  const res = await q(
    `DELETE FROM "cashMovimentsAttachments" WHERE id = $1 RETURNING id`,
    [Number(id)]
  );

  return res.rowCount > 0;
}

export async function copyAttachmentsFromAccountsPayable({
  account_payable_id,
  movimentacao_id,
  cash_movement_id,
}) {
  const finalMovementId = cash_movement_id ?? movimentacao_id;

  if (!account_payable_id || !finalMovementId) return [];

  const attRes = await q(
    `
    SELECT
      file_type,
      file_name,
      file_url
    FROM public."accountsPayableAttachments"
    WHERE account_payable_id = $1
    ORDER BY id ASC
    `,
    [Number(account_payable_id)]
  );

  const created = [];
  const bucket = storage.bucket(BUCKET_NAME);

  for (const att of attRes.rows) {
    if (!att.file_url) continue;

    const fileType = String(att.file_type || '').toUpperCase();

    const filename =
      att.file_name ||
      `${fileType || 'ANEXO'}-${account_payable_id}`;

    const mimeType =
      fileType === 'XML'
        ? 'application/xml'
        : fileType === 'DANFE'
          ? 'application/pdf'
          : 'application/octet-stream';

    const localPath = resolvePublicFile(att.file_url);

    if (!localPath) {
      console.warn('[CAIXA][ANEXOS][AP_FILE_NOT_FOUND]', {
        account_payable_id,
        movimentacao_id: finalMovementId,
        file_url: att.file_url,
      });
      continue;
    }

    const exists = await q(
      `
      SELECT id
      FROM "cashMovimentsAttachments"
      WHERE cash_movement_id = $1
        AND file_name = $2
      `,
      [Number(finalMovementId), filename]
    );

    if (exists.rowCount) continue;

    const gcsPath = buildCaixaObjectPath({
      movimentacao_id: finalMovementId,
      filename,
    });

    if (localPath.startsWith('https://storage.googleapis.com/')) {
      const sourceUrl = new URL(localPath);
      const sourcePath = sourceUrl.pathname.replace(/^\/[^/]+\//, '');

      await bucket
        .file(sourcePath)
        .copy(bucket.file(gcsPath));
    } else {
      await bucket.upload(localPath, {
        destination: gcsPath,
        resumable: false,
        metadata: {
          contentType: mimeType,
          cacheControl: 'no-store',
        },
      });
    }

    let fileSize = 0;

    if (localPath.startsWith('https://storage.googleapis.com/')) {
      const [meta] = await bucket.file(gcsPath).getMetadata();
      fileSize = Number(meta.size || 0);
    } else {
      const stat = fs.statSync(localPath);
      fileSize = Number(stat.size || 0);
    }

    const ins = await addAnexo({
      cash_movement_id: finalMovementId,
      file_name: filename,
      mime_type: mimeType,
      file_size_bytes: fileSize,
      storage_bucket: BUCKET_NAME,
      storage_path: gcsPath,
    });

    created.push(ins);
  }

  console.log('[CAIXA][ANEXOS][COPIED_FROM_AP_TO_GCS]', {
    account_payable_id,
    movimentacao_id: finalMovementId,
    bucket: BUCKET_NAME,
    count: created.length,
    paths: created.map((x) => x.gcs_path || x.storage_path),
  });

  return created;
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsSignature.repository.js — Imagem PNG da assinatura      ║
// ║ Tabela: public."nfeReceipts" (coluna signature_png)                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './nfeReceipts.constants.js';
import { requireAccessKey } from './nfeReceipts.utils.js';
import { ensureReady } from './nfeReceiptsSchema.repository.js';
import { getByNfeNumber } from './nfeReceiptsGet.repository.js';

/**
 * PNG BY ACCESS KEY — Buffer ou null
 */
export async function getSignaturePngByAccessKey(accessKey) {
  await ensureReady();

  const key = requireAccessKey(accessKey);

  const result = await pool.query(
    `
    SELECT signature_png
    FROM ${TB}
    WHERE access_key = $1
      AND signature_png IS NOT NULL
    LIMIT 1
    `,
    [key]
  );

  return result.rows[0]?.signature_png || null;
}

/**
 * PNG BY NF-e NUMBER — Buffer ou null
 */
export async function getSignaturePngByNfeNumber(nfeNumber) {
  const receipt = await getByNfeNumber(nfeNumber);

  if (!receipt?.access_key) {
    return null;
  }

  return getSignaturePngByAccessKey(receipt.access_key);
}

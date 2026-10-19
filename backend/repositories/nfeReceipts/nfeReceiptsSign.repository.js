// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsSign.repository.js — Assinatura do canhoto              ║
// ║ Tabela: public."nfeReceipts"                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './nfeReceipts.constants.js';
import { cleanDigits, decodeSignatureDataUrl, requireAccessKey } from './nfeReceipts.utils.js';
import { ensureReady } from './nfeReceiptsSchema.repository.js';
import { getByNfeNumber } from './nfeReceiptsGet.repository.js';

/**
 * SIGN BY ACCESS KEY — só altera canhotos PENDING ou já SIGNED
 */
export async function signReceiptByAccessKey(accessKey, payload = {}, meta = {}) {
  await ensureReady();

  const key = requireAccessKey(accessKey);
  const signatureBuffer = decodeSignatureDataUrl(payload.signatureDataUrl);

  const result = await pool.query(
    `
    UPDATE ${TB}
    SET
      status = 'SIGNED',
      receiver_name = $2,
      receiver_document = $3,
      receiver_phone = $4,
      received_at = COALESCE($5, NOW()),
      signature_png = COALESCE($6, signature_png),
      signature_path = COALESCE($7, signature_path),
      signature_url = COALESCE($8, signature_url),
      latitude = $9,
      longitude = $10,
      ip_address = $11,
      user_agent = $12,
      notes = $13,
      updated_at = NOW()
    WHERE access_key = $1
      AND status IN ('PENDING', 'SIGNED')
    RETURNING *
    `,
    [
      key,
      payload.receiverName || null,
      cleanDigits(payload.receiverDocument || ''),
      payload.receiverPhone || null,
      payload.receivedAt || null,
      signatureBuffer,
      payload.signaturePath || null,
      payload.signatureUrl || null,
      payload.latitude || null,
      payload.longitude || null,
      meta.ip || null,
      meta.userAgent || null,
      payload.notes || null,
    ]
  );

  return result.rows[0] || null;
}

/**
 * SIGN BY NF-e NUMBER
 */
export async function signReceiptByNfeNumber(nfeNumber, payload = {}, meta = {}) {
  const receipt = await getByNfeNumber(nfeNumber);

  if (!receipt?.access_key) {
    throw new Error('RECEIPT_NOT_FOUND');
  }

  return signReceiptByAccessKey(receipt.access_key, payload, meta);
}

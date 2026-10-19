// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsRefuse.repository.js — Recusa do canhoto                ║
// ║ Tabela: public."nfeReceipts"                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './nfeReceipts.constants.js';
import { requireAccessKey } from './nfeReceipts.utils.js';
import { ensureReady } from './nfeReceiptsSchema.repository.js';
import { getByNfeNumber } from './nfeReceiptsGet.repository.js';

/**
 * REFUSE BY ACCESS KEY — só altera canhotos PENDING ou já REFUSED
 */
export async function refuseReceiptByAccessKey(accessKey, payload = {}, meta = {}) {
  await ensureReady();

  const key = requireAccessKey(accessKey);

  const result = await pool.query(
    `
    UPDATE ${TB}
    SET
      status = 'REFUSED',
      refused_at = NOW(),
      refusal_reason = $2,
      ip_address = $3,
      user_agent = $4,
      updated_at = NOW()
    WHERE access_key = $1
      AND status IN ('PENDING', 'REFUSED')
    RETURNING *
    `,
    [
      key,
      payload.reason || null,
      meta.ip || null,
      meta.userAgent || null,
    ]
  );

  return result.rows[0] || null;
}

/**
 * REFUSE BY NF-e NUMBER
 */
export async function refuseReceiptByNfeNumber(nfeNumber, payload = {}, meta = {}) {
  const receipt = await getByNfeNumber(nfeNumber);

  if (!receipt?.access_key) {
    throw new Error('RECEIPT_NOT_FOUND');
  }

  return refuseReceiptByAccessKey(receipt.access_key, payload, meta);
}

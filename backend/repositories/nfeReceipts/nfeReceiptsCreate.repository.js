// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsCreate.repository.js — Cria canhoto PENDING             ║
// ║ Tabela: public."nfeReceipts"                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_INVOICES, ACCESS_KEY_LENGTH } from './nfeReceipts.constants.js';
import { cleanDigits, requireNfeId, requireNfeNumber } from './nfeReceipts.utils.js';
import { ensureReady } from './nfeReceiptsSchema.repository.js';

/**
 * CREATE PENDING — pelo invoice_id da NF-e (upsert por nfe_id)
 */
export async function createPendingReceiptByNfeId(nfeId) {
  await ensureReady();

  const safeNfeId = requireNfeId(nfeId);

  const nfe = await pool.query(
    `
    SELECT
      invoice_id,
      nfe_key
    FROM ${TB_INVOICES}
    WHERE invoice_id = $1
    LIMIT 1
    `,
    [safeNfeId]
  );

  if (!nfe.rows.length) {
    throw new Error('NFE_NOT_FOUND');
  }

  const accessKey = cleanDigits(nfe.rows[0].nfe_key);

  if (accessKey.length !== ACCESS_KEY_LENGTH) {
    throw new Error('INVALID_NFE_ACCESS_KEY');
  }

  const result = await pool.query(
    `
    INSERT INTO ${TB} (
      nfe_id,
      access_key,
      status
    )
    VALUES ($1, $2, 'PENDING')
    ON CONFLICT (nfe_id)
    DO UPDATE SET
      access_key = EXCLUDED.access_key,
      updated_at = NOW()
    RETURNING *
    `,
    [safeNfeId, accessKey]
  );

  return result.rows[0];
}

/**
 * CREATE PENDING — pelo número da NF-e (usa a emissão mais recente)
 */
export async function createPendingReceiptByNfeNumber(nfeNumber) {
  await ensureReady();

  const safeNumber = requireNfeNumber(nfeNumber);

  const nfe = await pool.query(
    `
    SELECT
      invoice_id,
      nfe_key
    FROM ${TB_INVOICES}
    WHERE nfe_number = $1
    ORDER BY issued_at DESC NULLS LAST, invoice_id DESC
    LIMIT 1
    `,
    [safeNumber]
  );

  if (!nfe.rows.length) {
    throw new Error('NFE_NOT_FOUND');
  }

  return createPendingReceiptByNfeId(nfe.rows[0].invoice_id);
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsGet.repository.js — Busca de um canhoto                 ║
// ║ Por chave de acesso, número da NF-e ou invoice_id                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_INVOICES, RECEIPT_SELECT } from './nfeReceipts.constants.js';
import { requireAccessKey, requireNfeId, requireNfeNumber } from './nfeReceipts.utils.js';
import { normalizeReceiptRow } from './nfeReceipts.mappers.js';
import { ensureReady } from './nfeReceiptsSchema.repository.js';
import { createPendingReceiptByNfeNumber } from './nfeReceiptsCreate.repository.js';

/**
 * GET BY ACCESS KEY
 */
export async function getByAccessKey(accessKey) {
  await ensureReady();

  const key = requireAccessKey(accessKey);

  const result = await pool.query(
    `
    SELECT ${RECEIPT_SELECT}
    FROM ${TB} r
    LEFT JOIN ${TB_INVOICES} i
      ON i.invoice_id = r.nfe_id
    WHERE r.access_key = $1
    LIMIT 1
    `,
    [key]
  );

  return normalizeReceiptRow(result.rows[0] || null);
}

async function findByNfeNumber(safeNumber) {
  const result = await pool.query(
    `
    SELECT ${RECEIPT_SELECT}
    FROM ${TB} r
    INNER JOIN ${TB_INVOICES} i
      ON i.invoice_id = r.nfe_id
    WHERE i.nfe_number = $1
    ORDER BY i.issued_at DESC NULLS LAST, i.invoice_id DESC
    LIMIT 1
    `,
    [safeNumber]
  );

  return result.rows[0] || null;
}

/**
 * GET BY NF-e NUMBER — cria o canhoto PENDING se ainda não existir
 */
export async function getByNfeNumber(nfeNumber) {
  await ensureReady();

  const safeNumber = requireNfeNumber(nfeNumber);

  let row = await findByNfeNumber(safeNumber);

  if (!row) {
    await createPendingReceiptByNfeNumber(safeNumber);
    row = await findByNfeNumber(safeNumber);
  }

  return normalizeReceiptRow(row);
}

/**
 * GET BY INVOICE ID
 */
export async function getByNfeId(nfeId) {
  await ensureReady();

  const safeNfeId = requireNfeId(nfeId);

  const result = await pool.query(
    `
    SELECT ${RECEIPT_SELECT}
    FROM ${TB} r
    LEFT JOIN ${TB_INVOICES} i
      ON i.invoice_id = r.nfe_id
    WHERE r.nfe_id = $1
    LIMIT 1
    `,
    [safeNfeId]
  );

  return normalizeReceiptRow(result.rows[0] || null);
}

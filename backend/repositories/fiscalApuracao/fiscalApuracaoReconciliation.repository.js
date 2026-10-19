// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalApuracaoReconciliation.repository.js — Divergências          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_FISCAL_APURACAO_RECON, ALIAS_FISCAL_APURACAO_RECON } from './fiscalApuracao.constants.js';
import { normalizeText } from './fiscalApuracao.sanitizers.js';

/* ======================================================================
   RECONCILIATION
   ====================================================================== */

export async function insertFiscalApuracaoReconciliation(data, client = pool) {
  const sql = `
    INSERT INTO "${TABLE_FISCAL_APURACAO_RECON}" (
      fiscal_apuracao_id,
      fiscal_apuracao_document_id,
      fiscal_apuracao_item_id,
      divergence_type,
      severity,
      document_key,
      product_code,
      sku,
      expected_value,
      actual_value,
      difference_value,
      details,
      status
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *
  `;

  const params = [
    data.fiscal_apuracao_id,
    data.fiscal_apuracao_document_id || null,
    data.fiscal_apuracao_item_id || null,
    normalizeText(data.divergence_type),
    normalizeText(data.severity, 'MEDIUM'),
    normalizeText(data.document_key),
    normalizeText(data.product_code),
    normalizeText(data.sku),
    data.expected_value ?? null,
    data.actual_value ?? null,
    data.difference_value ?? null,
    data.details || null,
    normalizeText(data.status, 'OPEN')
  ];

  const { rows } = await client.query(sql, params);
  return rows[0];
}

export async function listFiscalApuracaoReconciliation(
  fiscalApuracaoId,
  client = pool
) {
  const sql = `
    SELECT *
    FROM "${TABLE_FISCAL_APURACAO_RECON}" ${ALIAS_FISCAL_APURACAO_RECON}
    WHERE ${ALIAS_FISCAL_APURACAO_RECON}.fiscal_apuracao_id = $1
    ORDER BY
      ${ALIAS_FISCAL_APURACAO_RECON}.created_at DESC,
      ${ALIAS_FISCAL_APURACAO_RECON}.fiscal_apuracao_reconciliation_id DESC
  `;

  const { rows } = await client.query(sql, [fiscalApuracaoId]);
  return rows;
}

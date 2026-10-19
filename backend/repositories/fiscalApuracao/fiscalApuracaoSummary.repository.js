// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalApuracaoSummary.repository.js — Resumo (upsert / get)        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_FISCAL_APURACAO_SUMMARY, ALIAS_FISCAL_APURACAO_SUMMARY } from './fiscalApuracao.constants.js';
import { toNumber } from './fiscalApuracao.sanitizers.js';

/* ======================================================================
   SUMMARY
   ====================================================================== */

export async function upsertFiscalApuracaoSummary(data, client = pool) {
  const sql = `
    INSERT INTO "${TABLE_FISCAL_APURACAO_SUMMARY}" (
      fiscal_apuracao_id,
      icms_debit_total,
      icms_credit_total,
      icms_st_total,
      icms_payable_total,
      pis_debit_total,
      pis_credit_total,
      pis_payable_total,
      cofins_debit_total,
      cofins_credit_total,
      cofins_payable_total,
      ipi_debit_total,
      ipi_credit_total,
      ipi_payable_total,
      fcp_total,
      gross_documents_total,
      outgoing_documents_total,
      incoming_documents_total,
      icms_debit_base,
      icms_credit_base,
      icms_st_base,
      pis_debit_base,
      pis_credit_base,
      cofins_debit_base,
      cofins_credit_base,
      ipi_debit_base,
      ipi_credit_base,
      fcp_base
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
      $19,$20,$21,$22,$23,$24,$25,$26,$27,$28
    )
    ON CONFLICT (fiscal_apuracao_id)
    DO UPDATE SET
      icms_debit_total = EXCLUDED.icms_debit_total,
      icms_credit_total = EXCLUDED.icms_credit_total,
      icms_st_total = EXCLUDED.icms_st_total,
      icms_payable_total = EXCLUDED.icms_payable_total,
      pis_debit_total = EXCLUDED.pis_debit_total,
      pis_credit_total = EXCLUDED.pis_credit_total,
      pis_payable_total = EXCLUDED.pis_payable_total,
      cofins_debit_total = EXCLUDED.cofins_debit_total,
      cofins_credit_total = EXCLUDED.cofins_credit_total,
      cofins_payable_total = EXCLUDED.cofins_payable_total,
      ipi_debit_total = EXCLUDED.ipi_debit_total,
      ipi_credit_total = EXCLUDED.ipi_credit_total,
      ipi_payable_total = EXCLUDED.ipi_payable_total,
      fcp_total = EXCLUDED.fcp_total,
      gross_documents_total = EXCLUDED.gross_documents_total,
      outgoing_documents_total = EXCLUDED.outgoing_documents_total,
      incoming_documents_total = EXCLUDED.incoming_documents_total,
      icms_debit_base = EXCLUDED.icms_debit_base,
      icms_credit_base = EXCLUDED.icms_credit_base,
      icms_st_base = EXCLUDED.icms_st_base,
      pis_debit_base = EXCLUDED.pis_debit_base,
      pis_credit_base = EXCLUDED.pis_credit_base,
      cofins_debit_base = EXCLUDED.cofins_debit_base,
      cofins_credit_base = EXCLUDED.cofins_credit_base,
      ipi_debit_base = EXCLUDED.ipi_debit_base,
      ipi_credit_base = EXCLUDED.ipi_credit_base,
      fcp_base = EXCLUDED.fcp_base,
      updated_at = now()
    RETURNING *
  `;

  const params = [
    data.fiscal_apuracao_id,
    toNumber(data.icms_debit_total),
    toNumber(data.icms_credit_total),
    toNumber(data.icms_st_total),
    toNumber(data.icms_payable_total),
    toNumber(data.pis_debit_total),
    toNumber(data.pis_credit_total),
    toNumber(data.pis_payable_total),
    toNumber(data.cofins_debit_total),
    toNumber(data.cofins_credit_total),
    toNumber(data.cofins_payable_total),
    toNumber(data.ipi_debit_total),
    toNumber(data.ipi_credit_total),
    toNumber(data.ipi_payable_total),
    toNumber(data.fcp_total),
    toNumber(data.gross_documents_total),
    toNumber(data.outgoing_documents_total),
    toNumber(data.incoming_documents_total),
    toNumber(data.icms_debit_base),
    toNumber(data.icms_credit_base),
    toNumber(data.icms_st_base),
    toNumber(data.pis_debit_base),
    toNumber(data.pis_credit_base),
    toNumber(data.cofins_debit_base),
    toNumber(data.cofins_credit_base),
    toNumber(data.ipi_debit_base),
    toNumber(data.ipi_credit_base),
    toNumber(data.fcp_base)
  ];

  const { rows } = await client.query(sql, params);
  return rows[0];
}

export async function getFiscalApuracaoSummaryByApuracaoId(
  fiscalApuracaoId,
  client = pool
) {
  const sql = `
    SELECT *
    FROM "${TABLE_FISCAL_APURACAO_SUMMARY}" ${ALIAS_FISCAL_APURACAO_SUMMARY}
    WHERE ${ALIAS_FISCAL_APURACAO_SUMMARY}.fiscal_apuracao_id = $1
  `;

  const { rows } = await client.query(sql, [fiscalApuracaoId]);
  return rows[0] || null;
}

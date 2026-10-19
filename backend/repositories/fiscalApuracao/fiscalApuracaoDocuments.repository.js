// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalApuracaoDocuments.repository.js — Documentos da apuração     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_FISCAL_APURACAO_DOCUMENTS, ALIAS_FISCAL_APURACAO_DOCUMENTS } from './fiscalApuracao.constants.js';
import { toNumber, normalizeText } from './fiscalApuracao.sanitizers.js';

/* ======================================================================
   DOCUMENTS
   ====================================================================== */

export async function insertFiscalApuracaoDocument(data, client = pool) {
  const sql = `
    INSERT INTO "${TABLE_FISCAL_APURACAO_DOCUMENTS}" (
      fiscal_apuracao_id,
      document_type,
      model,
      serie,
      number,
      nfe_key,
      protocol,
      issue_date,
      issue_datetime,
      emit_tax_id,
      emit_name,
      dest_tax_id,
      dest_name,
      partner_tax_id,
      partner_name,
      total_products_value,
      total_nfe_value,
      total_icms_value,
      total_icms_st_value,
      total_fcp_value,
      total_ipi_value,
      total_pis_value,
      total_cofins_value,
      total_freight_value,
      total_discount_value,
      total_other_value,
      xml_source,
      xml_file_name,
      xml_file_path,
      xml_hash,
      order_id,
      inbound_invoice_id,
      status,
      import_errors,
      raw_payload
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
      $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
      $31,$32,$33,$34,$35
    )
    RETURNING *
  `;

  const params = [
    data.fiscal_apuracao_id,
    normalizeText(data.document_type),
    normalizeText(data.model),
    normalizeText(data.serie),
    normalizeText(data.number),
    normalizeText(data.nfe_key),
    normalizeText(data.protocol),
    data.issue_date || null,
    data.issue_datetime || null,
    normalizeText(data.emit_tax_id),
    normalizeText(data.emit_name),
    normalizeText(data.dest_tax_id),
    normalizeText(data.dest_name),
    normalizeText(data.partner_tax_id),
    normalizeText(data.partner_name),
    toNumber(data.total_products_value),
    toNumber(data.total_nfe_value),
    toNumber(data.total_icms_value),
    toNumber(data.total_icms_st_value),
    toNumber(data.total_fcp_value),
    toNumber(data.total_ipi_value),
    toNumber(data.total_pis_value),
    toNumber(data.total_cofins_value),
    toNumber(data.total_freight_value),
    toNumber(data.total_discount_value),
    toNumber(data.total_other_value),
    normalizeText(data.xml_source, 'UPLOAD'),
    normalizeText(data.xml_file_name),
    normalizeText(data.xml_file_path),
    normalizeText(data.xml_hash),
    data.order_id || null,
    data.inbound_invoice_id || null,
    normalizeText(data.status, 'IMPORTED'),
    data.import_errors || null,
    data.raw_payload || null
  ];

  const { rows } = await client.query(sql, params);
  return rows[0];
}

export async function listFiscalApuracaoDocuments(
  fiscalApuracaoId,
  client = pool
) {
  const sql = `
    SELECT *
    FROM "${TABLE_FISCAL_APURACAO_DOCUMENTS}" ${ALIAS_FISCAL_APURACAO_DOCUMENTS}
    WHERE ${ALIAS_FISCAL_APURACAO_DOCUMENTS}.fiscal_apuracao_id = $1
    ORDER BY
      ${ALIAS_FISCAL_APURACAO_DOCUMENTS}.issue_date ASC,
      ${ALIAS_FISCAL_APURACAO_DOCUMENTS}.fiscal_apuracao_document_id ASC
  `;

  const { rows } = await client.query(sql, [fiscalApuracaoId]);
  return rows;
}

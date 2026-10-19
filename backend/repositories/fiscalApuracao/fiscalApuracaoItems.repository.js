// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalApuracaoItems.repository.js — Itens da apuração              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_FISCAL_APURACAO_ITEMS, ALIAS_FISCAL_APURACAO_ITEMS } from './fiscalApuracao.constants.js';
import { toNumber, normalizeText } from './fiscalApuracao.sanitizers.js';

/* ======================================================================
   ITEMS
   ====================================================================== */

export async function insertFiscalApuracaoItem(data, client = pool) {
  const sql = `
    INSERT INTO "${TABLE_FISCAL_APURACAO_ITEMS}" (
      fiscal_apuracao_id,
      fiscal_apuracao_document_id,
      item_number,
      product_code,
      sku,
      ean,
      description,
      ncm_code,
      cest_code,
      cfop,
      unit,
      quantity,
      unit_value,
      gross_value,
      discount_value,
      freight_value,
      other_value,
      insurance_value,
      net_value,
      origin_code,
      icms_cst,
      icms_csosn,
      icms_rate,
      icms_base,
      icms_value,
      icms_st_rate,
      icms_st_base,
      icms_st_value,
      fcp_rate,
      fcp_base,
      fcp_value,
      pis_cst,
      pis_rate,
      pis_base,
      pis_value,
      cofins_cst,
      cofins_rate,
      cofins_base,
      cofins_value,
      ipi_cst,
      ipi_rate,
      ipi_base,
      ipi_value,
      tax_role,
      source_type,
      products_fiscal_id,
      fiscal_profile_id,
      fiscal_classification_id,
      raw_payload
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
      $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
      $31,$32,$33,$34,$35,$36,$37,$38,$39,$40,
      $41,$42,$43,$44,$45,$46,$47,$48,$49
    )
    RETURNING *
  `;

  const params = [
    data.fiscal_apuracao_id,
    data.fiscal_apuracao_document_id,
    data.item_number || null,
    normalizeText(data.product_code),
    normalizeText(data.sku),
    normalizeText(data.ean),
    normalizeText(data.description),
    normalizeText(data.ncm_code),
    normalizeText(data.cest_code),
    normalizeText(data.cfop),
    normalizeText(data.unit),
    toNumber(data.quantity),
    toNumber(data.unit_value),
    toNumber(data.gross_value),
    toNumber(data.discount_value),
    toNumber(data.freight_value),
    toNumber(data.other_value),
    toNumber(data.insurance_value),
    toNumber(data.net_value),
    normalizeText(data.origin_code),
    normalizeText(data.icms_cst),
    normalizeText(data.icms_csosn),
    toNumber(data.icms_rate),
    toNumber(data.icms_base),
    toNumber(data.icms_value),
    toNumber(data.icms_st_rate),
    toNumber(data.icms_st_base),
    toNumber(data.icms_st_value),
    toNumber(data.fcp_rate),
    toNumber(data.fcp_base),
    toNumber(data.fcp_value),
    normalizeText(data.pis_cst),
    toNumber(data.pis_rate),
    toNumber(data.pis_base),
    toNumber(data.pis_value),
    normalizeText(data.cofins_cst),
    toNumber(data.cofins_rate),
    toNumber(data.cofins_base),
    toNumber(data.cofins_value),
    normalizeText(data.ipi_cst),
    toNumber(data.ipi_rate),
    toNumber(data.ipi_base),
    toNumber(data.ipi_value),
    normalizeText(data.tax_role),
    normalizeText(data.source_type),
    data.products_fiscal_id || null,
    data.fiscal_profile_id || null,
    data.fiscal_classification_id || null,
    data.raw_payload || null
  ];

  const { rows } = await client.query(sql, params);
  return rows[0];
}

export async function listFiscalApuracaoItems(
  fiscalApuracaoId,
  client = pool
) {
  const sql = `
    SELECT *
    FROM "${TABLE_FISCAL_APURACAO_ITEMS}" ${ALIAS_FISCAL_APURACAO_ITEMS}
    WHERE ${ALIAS_FISCAL_APURACAO_ITEMS}.fiscal_apuracao_id = $1
    ORDER BY
      ${ALIAS_FISCAL_APURACAO_ITEMS}.fiscal_apuracao_document_id ASC,
      ${ALIAS_FISCAL_APURACAO_ITEMS}.item_number ASC,
      ${ALIAS_FISCAL_APURACAO_ITEMS}.fiscal_apuracao_item_id ASC
  `;

  const { rows } = await client.query(sql, [fiscalApuracaoId]);
  return rows;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ listItemsByInvoice.repository.js — CONSART ERP | Notas de Entrada       ║
// ║ Itens da NF-e de entrada + descrição e estoque do produto vinculado      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  TB_III,
  q,
  itemResponse,
} from './_shared.js';

export async function listItemsByInvoice(inboundId) {
  const res = await q(
    `
      SELECT
        inbound_item_id,
        inbound_id,
        nfe_item_seq,
        nf_product_code,
        product_code,
        product_id,
        product_grade_id,
        lot_id,
        barcode,
        manufacturer_ref,
        description,
        ncm,
        cest,
        benefit_code,
        cfop,
        unit,
        quantity,
        unit_price,
        total_price,
        commercial_unit,
        commercial_quantity,
        commercial_unit_price,
        taxable_unit,
        taxable_quantity,
        taxable_unit_price,
        conversion_factor,
        gross_total,
        discount_value,
        freight_value,
        insurance_value,
        other_expenses,
        net_total,
        ipi,
        icms,
        icms_origin,
        icms_cst,
        icms_modality,
        icms_base,
        icms_reduction_rate,
        icms_rate,
        icms_value,
        icms_st_modality,
        icms_st_mva_rate,
        icms_st_reduction_rate,
        icms_st_base,
        icms_st_rate,
        icms_st_value,
        fcp_base,
        fcp_rate,
        fcp_value,
        fcp_st_base,
        fcp_st_rate,
        fcp_st_value,
        ipi_cst,
        ipi_base,
        ipi_rate,
        ipi_value,
        pis_cst,
        pis_base,
        pis_rate,
        pis_value,
        cofins_cst,
        cofins_base,
        cofins_rate,
        cofins_value,
        ibs_cst,
        ibs_classification_code,
        ibs_base,
        ibs_state_rate,
        ibs_state_value,
        ibs_city_rate,
        ibs_city_value,
        ibs_value,
        cbs_cst,
        cbs_classification_code,
        cbs_base,
        cbs_rate,
        cbs_value,
        nfe_key,
        raw_product_payload,
        raw_tax_payload,
        created_at,
        updated_at,
        (
          SELECT p.description
            FROM public.products p
           WHERE p.product_code = iii.product_code
           LIMIT 1
        ) AS product_description,
        (
          SELECT p.product_stock_id
            FROM public.products p
           WHERE p.product_code = iii.product_code
           LIMIT 1
        ) AS product_stock_id
      FROM ${TB_III} iii
      WHERE iii.inbound_id = $1
      ORDER BY iii.nfe_item_seq, iii.inbound_item_id
    `,
    [inboundId]
  );

  return res.rows.map(itemResponse);
}

export default listItemsByInvoice;

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ outboundDocuments.source.js                                         ║
// ║ Documentos de saída para o SPED Fiscal — invoicesIssued             ║
// ║ CONSART ERP                                                         ║
// ║ ✅ Fonte: public."invoicesIssued"                                   ║
// ║ ✅ Itens: public."orderItems"                                       ║
// ║ ✅ Fiscal: "productsFiscalV2" → classification_v2 → profile_v2      ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import pool from '../../../config/db.js';

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sumBy(list = [], field) {
  return list.reduce((acc, item) => acc + toNumber(item?.[field]), 0);
}

function normalizeFiscalProductCode(value) {
  const code = String(value ?? '').trim();
  if (!/^\d+$/.test(code)) return code;

  const significant = code.replace(/^0+/, '') || '0';
  return significant.padStart(6, '0');
}

async function getOutboundItems(orderId) {
  if (!orderId) return [];

  try {
    const { rows } = await pool.query(
      `
        WITH item_fiscal AS (
          SELECT
            oi.*,
            p.description AS product_description,
            p.tax_icms_sale_percent,
            p.tax_icms_st_value,
            p.tax_ipi_value,
            p.tax_pis_sale_percent,
            p.tax_cofins_sale_percent,

            NULLIF(
              regexp_replace(COALESCE(fp.icms_cst, ''), '\\D+', '', 'g'),
              ''
            ) AS normalized_icms_code,

            COALESCE(
              NULLIF(regexp_replace(COALESCE(fp.origin_code, ''), '\\D+', '', 'g'), ''),
              '0'
            ) AS normalized_origin_code,

            fp.cfop_exit,
            fp.icms_rate AS profile_icms_rate,
            fp.pis_cst,
            fp.pis_rate,
            fp.cofins_cst,
            fp.cofins_rate

          FROM public."orderItems" oi

          LEFT JOIN public.products p
            ON NULLIF(ltrim(p.product_code::text, '0'), '')
             = NULLIF(ltrim(oi.sku::text, '0'), '')

          LEFT JOIN LATERAL (
            SELECT
              pf.fiscal_classification_id
            FROM public."productsFiscalV2" pf
            WHERE NULLIF(ltrim(pf.product_code::text, '0'), '')
                = NULLIF(ltrim(oi.sku::text, '0'), '')
              AND pf.is_current = true
              AND pf.is_active = true
            ORDER BY
              pf.version DESC,
              pf.products_fiscal_id DESC
            LIMIT 1
          ) current_pf ON true

          LEFT JOIN public."fiscalClassificationV2" fc
            ON fc.fiscal_classification_id = current_pf.fiscal_classification_id

          LEFT JOIN public."fiscalProfileV2" fp
            ON fp.fiscal_profile_id = fc.fiscal_profile_id

          WHERE oi.order_id = $1
        )

        SELECT
          item_fiscal.sku::text AS codigo_produto,
          COALESCE(item_fiscal.description, item_fiscal.product_description, '') AS descricao,
          COALESCE(item_fiscal.quantity, 0) AS quantidade,
          COALESCE(item_fiscal.unit, 'UN') AS unidade,

          COALESCE(item_fiscal.quantity, 0)
            * COALESCE(item_fiscal.unit_price, 0) AS valor_item,

          COALESCE(item_fiscal.discount_value, 0) AS valor_desconto,
          '1'::text AS movimenta_estoque,

          CASE
            WHEN item_fiscal.normalized_icms_code IN (
              '101', '102', '103', '201', '202', '203',
              '300', '400', '500', '900'
            ) THEN ''
            WHEN length(item_fiscal.normalized_icms_code) = 2
              THEN LEFT(item_fiscal.normalized_origin_code, 1)
                   || item_fiscal.normalized_icms_code
            ELSE COALESCE(item_fiscal.normalized_icms_code, '')
          END::text AS cst_icms,

          CASE
            WHEN item_fiscal.normalized_icms_code IN (
              '101', '102', '103', '201', '202', '203',
              '300', '400', '500', '900'
            ) THEN item_fiscal.normalized_icms_code
            ELSE ''
          END::text AS csosn,

          COALESCE(item_fiscal.cfop_exit, '')::text AS cfop,
          ''::text AS codigo_natureza,

          GREATEST(
            COALESCE(item_fiscal.quantity, 0)
              * COALESCE(item_fiscal.unit_price, 0)
              - COALESCE(item_fiscal.discount_value, 0),
            0
          ) AS valor_bc_icms,

          COALESCE(
            item_fiscal.profile_icms_rate,
            item_fiscal.tax_icms_sale_percent,
            0
          ) AS aliq_icms,

          ROUND(
            GREATEST(
              COALESCE(item_fiscal.quantity, 0)
                * COALESCE(item_fiscal.unit_price, 0)
                - COALESCE(item_fiscal.discount_value, 0),
              0
            )
            * COALESCE(
                item_fiscal.profile_icms_rate,
                item_fiscal.tax_icms_sale_percent,
                0
              )
            / 100,
            2
          ) AS valor_icms,

          0::numeric AS valor_bc_icms_st,
          0::numeric AS aliq_st,
          /*
           * The product catalogue value is not the ICMS-ST amount of this
           * issued invoice item. Do not create an E200 liability from it.
           */
          0::numeric AS valor_icms_st,

          ''::text AS apuracao_ipi,
          ''::text AS cst_ipi,
          ''::text AS cod_enq,

          CASE
            WHEN COALESCE(item_fiscal.tax_ipi_value, 0) > 0
              THEN GREATEST(
                COALESCE(item_fiscal.quantity, 0)
                  * COALESCE(item_fiscal.unit_price, 0)
                  - COALESCE(item_fiscal.discount_value, 0),
                0
              )
            ELSE 0
          END AS valor_bc_ipi,

          0::numeric AS aliq_ipi,
          COALESCE(item_fiscal.tax_ipi_value, 0) AS valor_ipi,

          COALESCE(item_fiscal.pis_cst, '')::text AS cst_pis,

          GREATEST(
            COALESCE(item_fiscal.quantity, 0)
              * COALESCE(item_fiscal.unit_price, 0)
              - COALESCE(item_fiscal.discount_value, 0),
            0
          ) AS valor_bc_pis,

          COALESCE(
            item_fiscal.pis_rate,
            item_fiscal.tax_pis_sale_percent,
            0
          ) AS aliq_pis,

          0::numeric AS quant_bc_pis,
          0::numeric AS aliq_pis_reais,

          ROUND(
            GREATEST(
              COALESCE(item_fiscal.quantity, 0)
                * COALESCE(item_fiscal.unit_price, 0)
                - COALESCE(item_fiscal.discount_value, 0),
              0
            )
            * COALESCE(
                item_fiscal.pis_rate,
                item_fiscal.tax_pis_sale_percent,
                0
              )
            / 100,
            2
          ) AS valor_pis,

          COALESCE(item_fiscal.cofins_cst, '')::text AS cst_cofins,

          GREATEST(
            COALESCE(item_fiscal.quantity, 0)
              * COALESCE(item_fiscal.unit_price, 0)
              - COALESCE(item_fiscal.discount_value, 0),
            0
          ) AS valor_bc_cofins,

          COALESCE(
            item_fiscal.cofins_rate,
            item_fiscal.tax_cofins_sale_percent,
            0
          ) AS aliq_cofins,

          0::numeric AS quant_bc_cofins,
          0::numeric AS aliq_cofins_reais,

          ROUND(
            GREATEST(
              COALESCE(item_fiscal.quantity, 0)
                * COALESCE(item_fiscal.unit_price, 0)
                - COALESCE(item_fiscal.discount_value, 0),
              0
            )
            * COALESCE(
                item_fiscal.cofins_rate,
                item_fiscal.tax_cofins_sale_percent,
                0
              )
            / 100,
            2
          ) AS valor_cofins,

          ''::text AS cod_cta,
          0::numeric AS valor_reducao_bc

        FROM item_fiscal
        ORDER BY item_fiscal.order_item_id ASC
      `,
      [orderId],
    );

    return rows.map(item => ({
      ...item,
      codigo_produto: normalizeFiscalProductCode(item.codigo_produto),
      quantidade: toNumber(item.quantidade),
      valor_item: toNumber(item.valor_item),
      valor_desconto: toNumber(item.valor_desconto),
      valor_bc_icms: toNumber(item.valor_bc_icms),
      aliq_icms: toNumber(item.aliq_icms),
      valor_icms: toNumber(item.valor_icms),
      valor_bc_icms_st: toNumber(item.valor_bc_icms_st),
      aliq_st: toNumber(item.aliq_st),
      valor_icms_st: toNumber(item.valor_icms_st),
      valor_bc_ipi: toNumber(item.valor_bc_ipi),
      aliq_ipi: toNumber(item.aliq_ipi),
      valor_ipi: toNumber(item.valor_ipi),
      valor_bc_pis: toNumber(item.valor_bc_pis),
      aliq_pis: toNumber(item.aliq_pis),
      valor_pis: toNumber(item.valor_pis),
      valor_bc_cofins: toNumber(item.valor_bc_cofins),
      aliq_cofins: toNumber(item.aliq_cofins),
      valor_cofins: toNumber(item.valor_cofins),
      valor_reducao_bc: toNumber(item.valor_reducao_bc),
    }));
  } catch (error) {
    console.error('[SPED Fiscal] getOutboundItems V2 error.', {
      order_id: orderId,
      message: error.message,
      code: error.code || null,
      detail: error.detail || null,
      table: error.table || null,
      column: error.column || null,
      constraint: error.constraint || null,
      stack: error.stack || null,
    });

    return [];
  }
}

export async function getOutboundDocumentsSource({ period }) {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          i.invoice_id AS id,
          i.order_id,
          i.nfe_number::text AS numero,
          '1'::text AS serie,
          COALESCE(i.nfe_key, '')::text AS chave,
          COALESCE(i.issued_at, i.created_at) AS data_emissao,
          COALESCE(i.issued_at, i.created_at) AS data_entrada_saida,
          COALESCE(i.total_amount, 0) AS valor_total,
          0::numeric AS valor_mercadorias,
          0::numeric AS valor_frete,
          0::numeric AS valor_seguro,
          0::numeric AS outras_despesas,
          0::numeric AS valor_desconto,
          0::numeric AS valor_bc_icms,
          0::numeric AS valor_icms,
          0::numeric AS valor_bc_icms_st,
          0::numeric AS valor_icms_st,
          0::numeric AS valor_ipi,
          0::numeric AS valor_pis,
          0::numeric AS valor_cofins,
          '55'::text AS cod_mod,
          '00'::text AS cod_sit,
          '1'::text AS ind_oper,
          '0'::text AS ind_emit,
          CASE
            WHEN COALESCE(document_customer.customer_id, o.customer_id) IS NULL
              THEN ''
            ELSE 'C' || COALESCE(
              document_customer.customer_id,
              o.customer_id
            )::text
          END AS participante_codigo,
          '0'::text AS ind_pgto,
          '9'::text AS ind_frt,
          COALESCE(i.customer_tax_id, o.customer_tax_id, '')::text AS customer_document,
          COALESCE(o.customer_name, i.customer_name, '')::text AS customer_name,
          i.nfe_status::text AS status

        FROM public."invoicesIssued" i

        LEFT JOIN public.orders o
          ON o.order_id = i.order_id

        LEFT JOIN LATERAL (
          SELECT c.customer_id
          FROM public.customers c
          WHERE regexp_replace(COALESCE(c.tax_id, ''), '\\D+', '', 'g')
              = regexp_replace(
                  COALESCE(i.customer_tax_id, o.customer_tax_id, ''),
                  '\\D+',
                  '',
                  'g'
                )
          ORDER BY c.customer_id
          LIMIT 1
        ) document_customer ON true

        WHERE COALESCE(i.issued_date, i.issued_at::date, i.created_at::date) >= $1::date
          AND COALESCE(i.issued_date, i.issued_at::date, i.created_at::date) <= $2::date
          AND UPPER(COALESCE(i.nfe_status, '')) IN (
            'AUTORIZADA',
            'AUTORIZADO',
            'CONCLUIDO',
            'CONCLUÍDO'
          )
          AND i.cancelled_at IS NULL

        ORDER BY
          COALESCE(i.issued_date, i.issued_at::date, i.created_at::date) ASC,
          i.nfe_number ASC NULLS LAST,
          i.invoice_id ASC
      `,
      [period.dateStart, period.dateEnd],
    );

    const normalized = [];

    for (const doc of rows) {
      const items = await getOutboundItems(doc.order_id);
      const itemTotal = sumBy(items, 'valor_item');
      const itemDiscount = sumBy(items, 'valor_desconto');
      const itemIcmsBase = sumBy(items, 'valor_bc_icms');
      const itemIcms = sumBy(items, 'valor_icms');
      const itemIcmsStBase = sumBy(items, 'valor_bc_icms_st');
      const itemIcmsSt = sumBy(items, 'valor_icms_st');
      const itemIpi = sumBy(items, 'valor_ipi');
      const itemPis = sumBy(items, 'valor_pis');
      const itemCofins = sumBy(items, 'valor_cofins');

      normalized.push({
        ...doc,
        valor_total: toNumber(doc.valor_total),
        valor_mercadorias: itemTotal || toNumber(doc.valor_total),
        valor_frete: 0,
        valor_seguro: 0,
        outras_despesas: 0,
        valor_desconto: itemDiscount,
        valor_bc_icms: itemIcmsBase,
        valor_icms: itemIcms,
        valor_bc_icms_st: itemIcmsStBase,
        valor_icms_st: itemIcmsSt,
        valor_ipi: itemIpi,
        valor_pis: itemPis,
        valor_cofins: itemCofins,
        source_type: 'outbound',
        items,
      });
    }

    console.info('[SPED Fiscal] outbound documents V2 loaded.', {
      document_count: normalized.length,
      item_count: normalized.reduce((acc, doc) => acc + doc.items.length, 0),
      documents_without_order: normalized.filter(doc => !doc.order_id).length,
      documents_without_participant: normalized.filter(
        doc => !doc.participante_codigo,
      ).length,
    });

    return normalized;
  } catch (error) {
    console.error('[SPED Fiscal] getOutboundDocumentsSource V2 error.', {
      message: error.message,
      code: error.code || null,
      detail: error.detail || null,
      table: error.table || null,
      column: error.column || null,
      constraint: error.constraint || null,
      stack: error.stack || null,
    });

    return [];
  }
}

export default {
  getOutboundDocumentsSource,
};

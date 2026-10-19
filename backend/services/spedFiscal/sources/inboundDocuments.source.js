// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inboundDocuments.source.js                                          ║
// ║ Documentos de entrada para o SPED Fiscal — inboundInvoices          ║
// ║ CONSART ERP                                                         ║
// ║ ✅ Schema real inboundInvoices / inboundInvoiceItems                 ║
// ║ ✅ Fiscal via "productsFiscalV2" usando product_code                 ║
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

function normalizeInboundCfop(value) {
  const cfop = String(value ?? '').replace(/\D+/g, '');
  if (!/^\d{4}$/.test(cfop)) return cfop;

  const firstDigitMap = { 5: '1', 6: '2', 7: '3' };
  return firstDigitMap[cfop[0]]
    ? `${firstDigitMap[cfop[0]]}${cfop.slice(1)}`
    : cfop;
}

async function getInboundItems(invoiceId) {
  if (!invoiceId) return [];

  try {
    const { rows } = await pool.query(
      `
        WITH item_fiscal AS (
          SELECT
            ii.*,

            NULLIF(
              regexp_replace(
                COALESCE(ii.icms_cst, fp.icms_cst, ''),
                '\\D+',
                '',
                'g'
              ),
              ''
            ) AS normalized_icms_code,

            COALESCE(
              NULLIF(regexp_replace(COALESCE(fp.origin_code, ''), '\\D+', '', 'g'), ''),
              '0'
            ) AS normalized_origin_code,

            fp.cfop_entry,
            fp.icms_rate AS profile_icms_rate,
            fp.pis_cst,
            fp.pis_rate,
            fp.cofins_cst,
            fp.cofins_rate

          FROM public."inboundInvoiceItems" ii

          LEFT JOIN LATERAL (
            SELECT
              pf.fiscal_classification_id
            FROM public."productsFiscalV2" pf
            WHERE NULLIF(ltrim(pf.product_code::text, '0'), '')
                = NULLIF(ltrim(ii.product_code::text, '0'), '')
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

          WHERE ii.invoice_id = $1
        )

        SELECT
          item_fiscal.product_code::text AS codigo_produto,
          COALESCE(item_fiscal.description, p.description, '') AS descricao,
          COALESCE(item_fiscal.quantity, 0) AS quantidade,
          COALESCE(item_fiscal.unit, 'UN') AS unidade,

          COALESCE(item_fiscal.total_price, 0) AS valor_item,
          0::numeric AS valor_desconto,

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

          COALESCE(
            NULLIF(item_fiscal.cfop, ''),
            item_fiscal.cfop_entry,
            ''
          )::text AS cfop,

          ''::text AS codigo_natureza,

          COALESCE(
            item_fiscal.icms_base,
            CASE
              WHEN COALESCE(item_fiscal.icms, 0) > 0
                THEN item_fiscal.total_price
              ELSE 0
            END,
            0
          ) AS valor_bc_icms,

          COALESCE(
            item_fiscal.icms_rate,
            item_fiscal.profile_icms_rate,
            CASE
              WHEN COALESCE(item_fiscal.total_price, 0) > 0
                THEN ROUND(
                  (COALESCE(item_fiscal.icms, 0) / item_fiscal.total_price) * 100,
                  4
                )
              ELSE 0
            END,
            0
          ) AS aliq_icms,

          COALESCE(item_fiscal.icms, 0) AS valor_icms,

          COALESCE(item_fiscal.icms_st_base, 0) AS valor_bc_icms_st,
          COALESCE(item_fiscal.icms_st_rate, 0) AS aliq_st,
          COALESCE(item_fiscal.icms_st_value, 0) AS valor_icms_st,

          ''::text AS apuracao_ipi,
          ''::text AS cst_ipi,
          ''::text AS cod_enq,

          CASE
            WHEN COALESCE(item_fiscal.ipi, 0) > 0
              THEN COALESCE(item_fiscal.total_price, 0)
            ELSE 0
          END AS valor_bc_ipi,

          CASE
            WHEN COALESCE(item_fiscal.total_price, 0) > 0
              THEN ROUND(
                (COALESCE(item_fiscal.ipi, 0) / item_fiscal.total_price) * 100,
                4
              )
            ELSE 0
          END AS aliq_ipi,

          COALESCE(item_fiscal.ipi, 0) AS valor_ipi,

          COALESCE(item_fiscal.pis_cst, '')::text AS cst_pis,
          COALESCE(item_fiscal.total_price, 0) AS valor_bc_pis,
          COALESCE(item_fiscal.pis_rate, 0) AS aliq_pis,
          0::numeric AS quant_bc_pis,
          0::numeric AS aliq_pis_reais,
          ROUND(
            COALESCE(item_fiscal.total_price, 0)
            * COALESCE(item_fiscal.pis_rate, 0)
            / 100,
            2
          ) AS valor_pis,

          COALESCE(item_fiscal.cofins_cst, '')::text AS cst_cofins,
          COALESCE(item_fiscal.total_price, 0) AS valor_bc_cofins,
          COALESCE(item_fiscal.cofins_rate, 0) AS aliq_cofins,
          0::numeric AS quant_bc_cofins,
          0::numeric AS aliq_cofins_reais,
          ROUND(
            COALESCE(item_fiscal.total_price, 0)
            * COALESCE(item_fiscal.cofins_rate, 0)
            / 100,
            2
          ) AS valor_cofins,

          ''::text AS cod_cta,
          0::numeric AS valor_reducao_bc

        FROM item_fiscal

        LEFT JOIN public.products p
          ON NULLIF(ltrim(p.product_code::text, '0'), '')
           = NULLIF(ltrim(item_fiscal.product_code::text, '0'), '')

        ORDER BY
          COALESCE(item_fiscal.nfe_item_seq, item_fiscal.id),
          item_fiscal.id
      `,
      [invoiceId],
    );

    return rows.map(item => ({
      ...item,
      codigo_produto: normalizeFiscalProductCode(item.codigo_produto),
      cfop: normalizeInboundCfop(item.cfop),
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
    console.error('[SPED Fiscal] getInboundItems V2 error.', {
      invoice_id: invoiceId,
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

export async function getInboundDocumentsSource({ period }) {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          n.id,
          n.invoice_number::text AS numero,
          COALESCE(n.series::text, '1') AS serie,
          COALESCE(n.access_key::text, '') AS chave,

          n.created_at AS data_emissao,
          n.created_at AS data_entrada_saida,

          COALESCE(n.total_amount, 0) AS valor_total,

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
          '0'::text AS ind_oper,
          '1'::text AS ind_emit,

          CASE
            WHEN s.supplier_id IS NULL THEN ''
            ELSE 'F' || s.supplier_id::text
          END AS participante_codigo,
          '0'::text AS ind_pgto,
          '9'::text AS ind_frt,

          n.issuer::text AS issuer_document,
          n.recipient::text AS recipient_document,
          n.status::text AS status

        FROM public."inboundInvoices" n

        LEFT JOIN public.suppliers s
          ON regexp_replace(COALESCE(s.tax_id, ''), '\\D+', '', 'g')
           = regexp_replace(COALESCE(n.issuer, ''), '\\D+', '', 'g')

        WHERE n.created_at::date >= $1::date
          AND n.created_at::date <= $2::date
          AND UPPER(COALESCE(n.status, 'AUTORIZADA')) NOT IN (
            'CANCELADA',
            'CANCELADO',
            'CANCELLED',
            'CANCELED',
            'DENEGADA',
            'DENEGADO',
            'REJEITADA',
            'REJECTED'
          )

        ORDER BY n.created_at ASC, n.id ASC
      `,
      [period.dateStart, period.dateEnd],
    );

    const normalized = [];

    for (const doc of rows) {
      const items = await getInboundItems(doc.id);

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
        source_type: 'inbound',
        items,
      });
    }

    console.info('[SPED Fiscal] inbound documents V2 loaded.', {
      document_count: normalized.length,
      item_count: normalized.reduce((acc, doc) => acc + doc.items.length, 0),
    });

    return normalized;
  } catch (error) {
    console.error('[SPED Fiscal] getInboundDocumentsSource V2 error.', {
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
  getInboundDocumentsSource,
};

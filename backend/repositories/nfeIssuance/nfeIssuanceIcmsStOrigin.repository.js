// ╔═══════════════════════════════════════════════════════════╗
// ║ nfeIssuanceIcmsStOrigin.repository.js — origem do ICMS-ST ║
// ║ NF-e de entrada → productsFiscalOrigins → LOTE-INICIAL    ║
// ╚═══════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  calculateForProduct as calculateProductFiscalCostRule,
} from '../productFiscalCostRules/productFiscalCostRules.index.js';
import {
  resolveForItem as resolveStoredProductFiscalOrigin,
} from '../productsFiscalOrigins/productsFiscalOrigins.index.js';
import { ICMS_ST_CANDIDATE_LIMIT } from './nfeIssuance.constants.js';
import { positiveInteger, normalizeCst, toNumberOrNull, roundTo, budgetItemBaseQuantity } from './nfeIssuance.utils.js';
import { normalizeInboundIcmsSt, calculateRetainedIcmsSt } from './nfeIssuance.icmsSt.js';

export async function resolveBudgetItemIcmsStOrigin(
  item,
  stockMode,
) {
  const productCode = String(
    item?.product_code ||
    item?.sku ||
    '',
  ).trim();

  if (!productCode) {
    console.warn(
      '[BUDGET NFE][ICMS-ST ORIGIN][PRODUCT_CODE_REQUIRED]',
      {
        item,
      },
    );

    return null;
  }

  const gradeId =
    positiveInteger(item?.grade_id);

  /*
   * ================================================================
   * STOCK_WITH_LOT
   * ================================================================
   *
   * A origem fiscal deve pertencer:
   *
   *   - ao mesmo product_code;
   *   - ao mesmo lot_id selecionado no orçamento.
   *
   * IMPORTANTE:
   * O SQL NÃO filtra previamente os campos de ICMS-ST.
   *
   * Primeiro buscamos todas as possíveis entradas fiscais do lote.
   * Depois normalizeInboundIcmsSt() decide se a origem possui:
   *
   *   - colunas normalizadas;
   *   - payload JSON normalizado;
   *   - payload XML/xml2js;
   *
   * com ICMS-ST completo.
   * ================================================================
   */
  if (stockMode?.isWithLot) {
    const lotId =
      positiveInteger(item?.lot_id);

    if (!lotId) {
      console.warn(
        '[BUDGET NFE][ICMS-ST ORIGIN][LOT_REQUIRED]',
        {
          stock_mode:
            stockMode?.mode || null,

          product_code:
            productCode,

          lot_id:
            item?.lot_id ?? null,

          lot_code:
            item?.lot_code ??
            item?.lot_number ??
            null,

          grade_id:
            gradeId,
        },
      );

      return null;
    }

    const { rows } = await pool.query(
      `
        SELECT
          ii.inbound_item_id,
          ii.inbound_id,
          ii.nfe_key,
          ii.nfe_item_seq,
          ii.created_at,

          ii.product_code,
          ii.product_id,
          ii.product_grade_id,
          pg.grade_id,

          ii.lot_id,

          ii.unit,
          ii.quantity,
          ii.conversion_factor,

          ii.icms_cst,
          ii.icms_value,

          ii.icms_st_mva_rate,
          ii.icms_st_base,
          ii.icms_st_rate,
          ii.icms_st_value,

          ii.fcp_st_base,
          ii.fcp_st_rate,
          ii.fcp_st_value,

          ii.raw_tax_payload

        FROM public."inboundInvoiceItems" ii

        LEFT JOIN public."productsGrades" pg
          ON pg.product_grade_id =
             ii.product_grade_id

        WHERE ii.lot_id = $1
          AND TRIM(ii.product_code) = $2

        ORDER BY
          CASE
            WHEN $3::integer IS NOT NULL
             AND pg.grade_id = $3::integer
            THEN 0
            ELSE 1
          END,

          /*
           * Candidatos que já possuem as três colunas ST
           * ficam à frente dos demais.
           */
          CASE
            WHEN ii.icms_st_base IS NOT NULL
             AND ii.icms_st_rate IS NOT NULL
             AND ii.icms_st_value IS NOT NULL
            THEN 0
            ELSE 1
          END,

          ii.created_at DESC,
          ii.inbound_item_id DESC

        LIMIT $4
      `,
      [
        lotId,
        productCode,
        gradeId,
        ICMS_ST_CANDIDATE_LIMIT,
      ],
    );

    /*
     * ==============================================================
     * DIAGNÓSTICO
     * ==============================================================
     *
     * Muito importante para sabermos exatamente quais entradas
     * fiscais foram encontradas para o lote.
     */
    console.log(
      '[BUDGET NFE][ICMS-ST ORIGIN][LOT][CANDIDATES]',
      {
        stock_mode:
          stockMode?.mode || null,

        product_code:
          productCode,

        lot_id:
          lotId,

        lot_code:
          item?.lot_code ??
          item?.lot_number ??
          null,

        grade_id:
          gradeId,

        candidates_count:
          rows.length,

        candidates:
          rows.map(
            (row) => ({
              inbound_item_id:
                row.inbound_item_id,

              inbound_id:
                row.inbound_id,

              product_code:
                row.product_code,

              lot_id:
                row.lot_id,

              product_grade_id:
                row.product_grade_id,

              grade_id:
                row.grade_id,

              quantity:
                row.quantity,

              conversion_factor:
                row.conversion_factor,

              icms_cst:
                row.icms_cst,

              icms_st_base:
                row.icms_st_base,

              icms_st_rate:
                row.icms_st_rate,

              icms_st_value:
                row.icms_st_value,

              has_raw_tax_payload:
                Boolean(
                  row.raw_tax_payload &&
                  Object.keys(
                    typeof row.raw_tax_payload === 'object'
                      ? row.raw_tax_payload
                      : {},
                  ).length,
                ),

              nfe_key:
                row.nfe_key,

              nfe_item_seq:
                row.nfe_item_seq,
            }),
          ),
      },
    );

    /*
     * ==============================================================
     * NORMALIZAÇÃO DOS CANDIDATOS
     * ==============================================================
     */
    for (const row of rows) {
      const origin =
        normalizeInboundIcmsSt(row);

      console.log(
        '[BUDGET NFE][ICMS-ST ORIGIN][LOT][NORMALIZED]',
        {
          product_code:
            productCode,

          lot_id:
            lotId,

          inbound_item_id:
            row.inbound_item_id,

          inbound_id:
            row.inbound_id,

          source_cst:
            origin?.source_cst ??
            null,

          source_values_from:
            origin?.source_values_from ??
            null,

          entry_base_quantity:
            origin?.entry_base_quantity ??
            null,

          st_base:
            origin?.st_base ??
            null,

          st_rate:
            origin?.st_rate ??
            null,

          st_value:
            origin?.st_value ??
            null,

          complete:
            Boolean(origin?.complete),
        },
      );

      if (origin?.complete) {
        console.log(
          '[BUDGET NFE][ICMS-ST ORIGIN][LOT][SELECTED]',
          {
            product_code:
              productCode,

            lot_id:
              lotId,

            inbound_item_id:
              origin.inbound_item_id,

            inbound_id:
              origin.inbound_id,

            source_cst:
              origin.source_cst,

            source_values_from:
              origin.source_values_from,

            st_base:
              origin.st_base,

            st_rate:
              origin.st_rate,

            st_value:
              origin.st_value,
          },
        );

        return origin;
      }
    }

    if (rows.length) {
      console.warn(
        '[BUDGET NFE][ICMS-ST ORIGIN][LOT] Entradas encontradas sem ST completo.',
        {
          stock_mode:
            stockMode?.mode || null,

          product_code:
            productCode,

          lot_id:
            lotId,

          lot_code:
            item?.lot_code ??
            item?.lot_number ??
            null,

          inbound_item_ids:
            rows.map(
              (row) =>
                row.inbound_item_id,
            ),
        },
      );
    } else {
      console.warn(
        '[BUDGET NFE][ICMS-ST ORIGIN][LOT] Nenhuma entrada encontrada para o lote.',
        {
          stock_mode:
            stockMode?.mode || null,

          product_code:
            productCode,

          lot_id:
            lotId,

          lot_code:
            item?.lot_code ??
            item?.lot_number ??
            null,

          grade_id:
            gradeId,
        },
      );
    }

    return null;
  }

  /*
   * ================================================================
   * STOCK_SIMPLE
   * ================================================================
   *
   * Não usa:
   *
   *   - product_id;
   *   - lot_id.
   *
   * A chave canônica do ERP é:
   *
   *   product_code
   *
   * Assim como em STOCK_WITH_LOT, não fazemos um filtro prematuro
   * do ICMS-ST no SQL.
   * ================================================================
   */

  if (!stockMode?.isSimple) {
    console.warn(
      '[BUDGET NFE][ICMS-ST ORIGIN][INVALID_STOCK_MODE]',
      {
        stock_mode:
          stockMode?.mode ?? null,

        product_code:
          productCode,
      },
    );

    return null;
  }

  const { rows } = await pool.query(
    `
      SELECT
        ii.inbound_item_id,
        ii.inbound_id,
        ii.nfe_key,
        ii.nfe_item_seq,
        ii.created_at,

        ii.product_code,
        ii.product_id,
        ii.product_grade_id,
        pg.grade_id,

        ii.lot_id,

        ii.unit,
        ii.quantity,
        ii.conversion_factor,

        ii.icms_cst,
        ii.icms_value,

        ii.icms_st_mva_rate,
        ii.icms_st_base,
        ii.icms_st_rate,
        ii.icms_st_value,

        ii.fcp_st_base,
        ii.fcp_st_rate,
        ii.fcp_st_value,

        ii.raw_tax_payload

      FROM public."inboundInvoiceItems" ii

      LEFT JOIN public."productsGrades" pg
        ON pg.product_grade_id =
           ii.product_grade_id

      WHERE TRIM(ii.product_code) = $1

      ORDER BY
        CASE
          WHEN $2::integer IS NOT NULL
           AND pg.grade_id = $2::integer
          THEN 0
          ELSE 1
        END,

        /*
         * Entradas que já possuem ICMS-ST normalizado
         * têm preferência.
         */
        CASE
          WHEN ii.icms_st_base IS NOT NULL
           AND ii.icms_st_rate IS NOT NULL
           AND ii.icms_st_value IS NOT NULL
          THEN 0
          ELSE 1
        END,

        ii.created_at DESC,
        ii.inbound_item_id DESC

      LIMIT $3
    `,
    [
      productCode,
      gradeId,
      ICMS_ST_CANDIDATE_LIMIT,
    ],
  );

  console.log(
    '[BUDGET NFE][ICMS-ST ORIGIN][SIMPLE][CANDIDATES]',
    {
      stock_mode:
        stockMode?.mode || null,

      product_code:
        productCode,

      grade_id:
        gradeId,

      candidates_count:
        rows.length,

      candidates:
        rows.map(
          (row) => ({
            inbound_item_id:
              row.inbound_item_id,

            inbound_id:
              row.inbound_id,

            product_code:
              row.product_code,

            lot_id:
              row.lot_id,

            product_grade_id:
              row.product_grade_id,

            grade_id:
              row.grade_id,

            quantity:
              row.quantity,

            conversion_factor:
              row.conversion_factor,

            icms_cst:
              row.icms_cst,

            icms_st_base:
              row.icms_st_base,

            icms_st_rate:
              row.icms_st_rate,

            icms_st_value:
              row.icms_st_value,

            has_raw_tax_payload:
              Boolean(
                row.raw_tax_payload &&
                Object.keys(
                  typeof row.raw_tax_payload === 'object'
                    ? row.raw_tax_payload
                    : {},
                ).length,
              ),

            nfe_key:
              row.nfe_key,

            nfe_item_seq:
              row.nfe_item_seq,
          }),
        ),
    },
  );

  for (const row of rows) {
    const origin =
      normalizeInboundIcmsSt(row);

    console.log(
      '[BUDGET NFE][ICMS-ST ORIGIN][SIMPLE][NORMALIZED]',
      {
        product_code:
          productCode,

        inbound_item_id:
          row.inbound_item_id,

        inbound_id:
          row.inbound_id,

        source_cst:
          origin?.source_cst ??
          null,

        source_values_from:
          origin?.source_values_from ??
          null,

        entry_base_quantity:
          origin?.entry_base_quantity ??
          null,

        st_base:
          origin?.st_base ??
          null,

        st_rate:
          origin?.st_rate ??
          null,

        st_value:
          origin?.st_value ??
          null,

        complete:
          Boolean(origin?.complete),
      },
    );

    if (origin?.complete) {
      console.log(
        '[BUDGET NFE][ICMS-ST ORIGIN][SIMPLE][SELECTED]',
        {
          product_code:
            productCode,

          inbound_item_id:
            origin.inbound_item_id,

          inbound_id:
            origin.inbound_id,

          source_cst:
            origin.source_cst,

          source_values_from:
            origin.source_values_from,

          st_base:
            origin.st_base,

          st_rate:
            origin.st_rate,

          st_value:
            origin.st_value,
        },
      );

      return origin;
    }
  }

  if (rows.length) {
    console.warn(
      '[BUDGET NFE][ICMS-ST ORIGIN][SIMPLE] Entradas encontradas sem ST completo.',
      {
        stock_mode:
          stockMode?.mode || null,

        product_code:
          productCode,

        inbound_item_ids:
          rows.map(
            (row) =>
              row.inbound_item_id,
          ),
      },
    );
  } else {
    console.warn(
      '[BUDGET NFE][ICMS-ST ORIGIN][SIMPLE] Nenhuma entrada encontrada para o produto.',
      {
        stock_mode:
          stockMode?.mode || null,

        product_code:
          productCode,

        grade_id:
          gradeId,
      },
    );
  }

  return null;
}

/**
 * Origem fiscal gravada em "productsFiscalOrigins".
 *
 * Usada quando o produto não possui NF-e de entrada capaz de fornecer o
 * ICMS-ST retido. A linha é calculada exclusivamente pela regra fiscal do
 * produto ("productsFiscalV2" -> classificação -> perfil) e gravada pelo
 * botão "Atualizar dados fiscais".
 *
 * IMPORTANTE:
 * - NUNCA tem prioridade sobre inboundInvoiceItems: só é consultada depois
 *   que a busca na NF-e de entrada não devolveu uma origem completa;
 * - vale nos dois modos de estoque — em STOCK_WITH_LOT procura pelo lote e
 *   cai para a origem padrão do produto; em STOCK_SIMPLE usa direto a
 *   origem padrão (lot_id NULL);
 * - a origem é marcada como PRODUCT_FISCAL_ORIGIN e nunca é apresentada
 *   como se tivesse vindo de uma NF-e de fornecedor.
 *
 * As colunas de "productsFiscalOrigins" espelham as de inboundInvoiceItems,
 * por isso normalizeInboundIcmsSt() é reaproveitada sem adaptação.
 */
export async function resolveStoredFiscalOriginIcmsSt(
  item,
  stockMode,
) {
  const productCode = String(
    item?.product_code ||
    item?.sku ||
    '',
  ).trim();

  if (!productCode) return null;

  // Em STOCK_SIMPLE não existe lote: busca apenas a origem padrão do produto.
  const lotId = stockMode?.isWithLot
    ? positiveInteger(item?.lot_id)
    : null;

  const productGradeId = positiveInteger(item?.product_grade_id);

  let row;

  try {
    row = await resolveStoredProductFiscalOrigin({
      productCode,
      lotId,
      productGradeId,
    });
  } catch (error) {
    console.warn(
      '[BUDGET NFE][ICMS-ST STORED FISCAL ORIGIN][FAILED]',
      {
        product_code: productCode,
        lot_id: lotId,
        error: error?.message || String(error),
      },
    );

    return null;
  }

  if (!row) return null;

  const normalized = normalizeInboundIcmsSt(row);

  if (!normalized?.complete) {
    console.warn(
      '[BUDGET NFE][ICMS-ST STORED FISCAL ORIGIN][INCOMPLETE]',
      {
        product_code: productCode,
        lot_id: lotId,
        fiscal_origin_id: row.fiscal_origin_id ?? null,
        icms_st_base: row.icms_st_base ?? null,
        icms_st_rate: row.icms_st_rate ?? null,
        icms_st_value: row.icms_st_value ?? null,
      },
    );

    return null;
  }

  const origin = {
    ...normalized,

    source_type: 'PRODUCT_FISCAL_ORIGIN',
    source_label: 'Origem fiscal do produto',
    source_values_from: 'productsFiscalOrigins',

    // Sem NF-e de entrada por definição desta origem.
    inbound_item_id: null,
    inbound_id: null,
    nfe_key: null,
    nfe_item_seq: null,

    fiscal_origin_id: row.fiscal_origin_id ?? null,
    fiscal_origin_scope: row.lot_id ? 'LOT' : 'PRODUCT',
    rule_id: row.rule_id ?? null,
    rule_source: row.rule_source ?? null,
    calculated_at: row.calculated_at ?? null,
  };

  const retained = calculateRetainedIcmsSt(origin, item);

  if (!retained) return null;

  console.log(
    '[BUDGET NFE][ICMS-ST STORED FISCAL ORIGIN][SELECTED]',
    {
      product_code: productCode,
      lot_id: lotId,
      stock_mode: stockMode?.mode || null,
      fiscal_origin_id: origin.fiscal_origin_id,
      fiscal_origin_scope: origin.fiscal_origin_scope,
      rule_source: origin.rule_source,
      vBCSTRet: retained.vBCSTRet,
      pST: retained.pST,
      vICMSSTRet: retained.vICMSSTRet,
    },
  );

  return { origin, retained };
}

/**
 * Fallback fiscal controlado para estoque legado de abertura.
 *
 * IMPORTANTE:
 * - só é permitido em STOCK_WITH_LOT;
 * - só é permitido para o lote sentinela LOTE-INICIAL;
 * - só é permitido quando NÃO existe nenhum inboundInvoiceItems para
 *   lot_id + product_code;
 * - a origem é marcada explicitamente como PRODUCT_FISCAL_RULE;
 * - nunca é apresentada como se tivesse vindo de uma NF-e de fornecedor.
 */
export async function resolveInitialLotProductFiscalRuleIcmsSt(
  item,
  stockMode,
) {
  if (!stockMode?.isWithLot) return null;

  const productCode = String(
    item?.product_code ||
    item?.sku ||
    '',
  ).trim();

  const lotId = positiveInteger(item?.lot_id);
  const lotCode = String(
    item?.lot_code ||
    item?.lot_number ||
    '',
  )
    .trim()
    .toUpperCase();

  if (!productCode || !lotId || lotCode !== 'LOTE-INICIAL') {
    return null;
  }

  /*
   * Não mascarar uma origem fiscal real/incompleta.
   * Se existe qualquer entrada vinculada ao lote, ela continua sendo a fonte
   * fiscal obrigatória e o fallback por regra de produto NÃO é usado.
   */
  const inboundCheck = await pool.query(
    `
      SELECT 1
      FROM public."inboundInvoiceItems" ii
      WHERE ii.lot_id = $1
        AND TRIM(ii.product_code) = $2
      LIMIT 1
    `,
    [lotId, productCode],
  );

  if (inboundCheck.rowCount > 0) {
    return null;
  }

  const saleBaseQuantity = budgetItemBaseQuantity(item);
  if (saleBaseQuantity === null) {
    return null;
  }

  let calculated;

  try {
    calculated = await calculateProductFiscalCostRule(
      productCode,
      {
        // null faz a API usar products.cost_price como base, exatamente como
        // a regra de custo fiscal do produto foi desenhada para funcionar.
        unitCost: null,
        quantity: saleBaseQuantity,
      },
      pool,
    );
  } catch (error) {
    console.warn(
      '[BUDGET NFE][ICMS-ST PRODUCT RULE FALLBACK][FAILED]',
      {
        product_code: productCode,
        lot_id: lotId,
        lot_code: lotCode,
        error: error?.message || String(error),
      },
    );

    return null;
  }

  const sourceCst = normalizeCst(calculated?.inbound_cst);
  const stBase = toNumberOrNull(calculated?.icms_st_base);
  const stRate = toNumberOrNull(calculated?.icms_st_rate);
  const stValue = toNumberOrNull(calculated?.icms_st_value);

  if (
    sourceCst !== '60' ||
    stBase === null ||
    stRate === null ||
    stValue === null
  ) {
    console.warn(
      '[BUDGET NFE][ICMS-ST PRODUCT RULE FALLBACK][INCOMPLETE]',
      {
        product_code: productCode,
        lot_id: lotId,
        lot_code: lotCode,
        rule_id: calculated?.rule_id ?? null,
        inbound_cst: calculated?.inbound_cst ?? null,
        icms_st_base: calculated?.icms_st_base ?? null,
        icms_st_rate: calculated?.icms_st_rate ?? null,
        icms_st_value: calculated?.icms_st_value ?? null,
      },
    );

    return null;
  }

  const origin = {
    complete: true,

    source_type: 'PRODUCT_FISCAL_RULE',
    source_label: calculated?.source_label || 'Regra fiscal do produto',
    source_values_from: 'productFiscalCostRules',
    source_cst: sourceCst,
    source_is_retained: false,

    // Sem NF-e de entrada por definição deste fallback.
    inbound_item_id: null,
    inbound_id: null,
    nfe_key: null,
    nfe_item_seq: null,
    entry_created_at: null,

    product_code: productCode,
    product_id: item?.product_id ?? null,
    product_grade_id: null,
    grade_id: item?.grade_id ?? null,

    lot_id: lotId,
    lot_code: item?.lot_code ?? item?.lot_number ?? 'LOTE-INICIAL',

    rule_id: calculated?.rule_id ?? null,
    rule_source: calculated?.rule_source ?? null,
    fiscal_classification_id:
      calculated?.fiscal_classification_id ?? null,
    fiscal_profile_id:
      calculated?.fiscal_profile_id ?? null,

    // A regra já foi calculada para exatamente a quantidade da operação.
    entry_unit: item?.unit_code ?? item?.unit ?? null,
    entry_quantity: saleBaseQuantity,
    entry_conversion_factor: 1,
    entry_base_quantity: saleBaseQuantity,

    mva_rate: toNumberOrNull(calculated?.mva_pct),
    st_base: stBase,
    st_rate: stRate,
    st_value: stValue,
    consumer_rate: stRate,
    own_icms_value: null,
    fcp_st_base: null,
    fcp_st_rate: null,
    fcp_st_value: null,
  };

  const retained = {
    sale_base_quantity: saleBaseQuantity,
    entry_base_quantity: saleBaseQuantity,
    proportion: 1,
    extrapolated: false,

    vBCSTRet: roundTo(stBase, 2),
    pST: roundTo(stRate, 4),
    vICMSSubstituto: null,
    vICMSSTRet: roundTo(stValue, 2),

    vBCFCPSTRet: null,
    pFCPSTRet: null,
    vFCPSTRet: null,
  };

  console.warn(
    '[BUDGET NFE][ICMS-ST PRODUCT RULE FALLBACK][SELECTED]',
    {
      product_code: productCode,
      lot_id: lotId,
      lot_code: lotCode,
      source_type: origin.source_type,
      rule_id: origin.rule_id,
      rule_source: origin.rule_source,
      source_cst: origin.source_cst,
      sale_base_quantity: saleBaseQuantity,
      vBCSTRet: retained.vBCSTRet,
      pST: retained.pST,
      vICMSSTRet: retained.vICMSSTRet,
      detail:
        'Lote inicial sem NF-e de entrada vinculada. Os valores foram calculados '
        + 'pela regra fiscal ativa do produto e mantêm origem explícita '
        + 'PRODUCT_FISCAL_RULE.',
    },
  );

  return {
    origin,
    retained,
  };
}

// ╔═════════════════════════════════════════════════════════════╗
// ║ nfeIssuanceItems.repository.js — itens fiscais do orçamento ║
// ║ enriquecimento, validação e preview da NF-e                 ║
// ╚═════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ITEM_ENRICHMENT_CONCURRENCY } from './nfeIssuance.constants.js';
import { normalizeCst, mapWithConcurrency } from './nfeIssuance.utils.js';
import { rowToFiscalBudgetItem } from './nfeIssuance.mappers.js';
import { calculateRetainedIcmsSt, applyRetainedIcmsSt } from './nfeIssuance.icmsSt.js';
import { resolveActiveStockMode, getBudgetIssuedData } from './nfeIssuanceFiscalContext.repository.js';
import { resolveBudgetItemIcmsStOrigin, resolveStoredFiscalOriginIcmsSt, resolveInitialLotProductFiscalRuleIcmsSt } from './nfeIssuanceIcmsStOrigin.repository.js';

async function enrichBudgetItemForNfe(
  item,
  stockMode,
) {
  const sku = String(item?.sku || item?.product_code || '').trim();
  if (!sku) return item;

  /*
   * Não existe fallback ao Fiscal V2 aqui: o SELECT principal
   * (getBudgetFiscalItems) usa exatamente os mesmos predicados de
   * productsFiscalV2Api.getCurrent (product_code + is_current + is_active).
   * Quando products_fiscal_id / fiscal_classification_id vêm nulos, getCurrent
   * também retornaria nulo — a ausência de configuração fiscal é validada em
   * assertBudgetItemsAreIssuable, antes da emissão.
   */
  const merged = { ...item, sku, product_code: sku };

  const cst = normalizeCst(merged.cst_icms ?? merged.icms_cst ?? '');

  // Somente CST 60 precisa da origem do ICMS-ST retido anteriormente.
  if (cst !== '60') return merged;

  let origin =
    await resolveBudgetItemIcmsStOrigin(
      merged,
      stockMode,
    );

  let retained = origin ? calculateRetainedIcmsSt(origin, merged) : null;

  /*
   * Muitos produtos não possuem mais a NF-e do fornecedor. Quando a entrada
   * não forneceu uma origem ST completa, usamos a origem fiscal gravada em
   * "productsFiscalOrigins", calculada a partir de "productsFiscalV2".
   *
   * Vem depois da NF-e de entrada de propósito: a entrada real continua
   * sendo a fonte preferencial do ICMS-ST retido.
   */
  if (!origin || !retained) {
    const stored =
      await resolveStoredFiscalOriginIcmsSt(
        merged,
        stockMode,
      );

    if (stored) {
      origin = stored.origin;
      retained = stored.retained;
    }
  }

  /*
   * LOTE-INICIAL é estoque legado/de abertura e pode não possuir uma NF-e de
   * entrada histórica. Somente nesse cenário, e somente quando não existe
   * qualquer inboundInvoiceItems para o lote + SKU, usamos a regra fiscal do
   * produto como origem calculada explícita (PRODUCT_FISCAL_RULE).
   */
  if (!origin || !retained) {
    const fallback =
      await resolveInitialLotProductFiscalRuleIcmsSt(
        merged,
        stockMode,
      );

    if (fallback) {
      origin = fallback.origin;
      retained = fallback.retained;
    }
  }

  if (!origin || !retained) {
    const reason = !origin
      ? stockMode.isWithLot
        ? String(merged.lot_code || merged.lot_number || '').trim().toUpperCase() === 'LOTE-INICIAL'
          ? 'o lote inicial não possui entrada fiscal vinculada e nenhuma regra fiscal '
          + 'de produto CST 60 completa pôde ser aplicada'
          : 'nenhuma entrada do lote selecionado possui ICMS-ST completo '
          + '(colunas, payload normalizado ou XML: vBCST/pICMSST/vICMSST '
          + 'ou vBCSTRet/pST/vICMSSTRet) e não há origem fiscal gravada '
          + 'para o produto — use "Atualizar dados fiscais" no lote'
        : 'nenhuma nota de entrada do produto possui ICMS-ST completo '
        + '(colunas, payload normalizado ou XML: vBCST/pICMSST/vICMSST '
        + 'ou vBCSTRet/pST/vICMSSTRet) e não há origem fiscal gravada '
        + 'para o produto — use "Atualizar dados fiscais" no lote'
      : 'a quantidade do item do orçamento é inválida para o rateio do ICMS-ST';

    console.warn('[BUDGET NFE][ICMS-ST ORIGIN NOT RESOLVED]', {
      sku,
      cst,
      stock_mode: stockMode.mode,
      lot_id: merged.lot_id ?? null,
      lot_code: merged.lot_code ?? null,
      product_id: merged.product_id ?? null,
      grade_id: merged.grade_id ?? null,
      quantity: merged.quantity ?? null,
      conversion_factor: merged.conversion_factor ?? null,
      reason,
    });

    const error = new Error(
      `[NFE] SKU ${sku}: CST 60 exige a origem do ICMS-ST, mas ${reason}.`,
    );
    error.status = 422;
    error.code = 'BUDGET_ITEM_ICMS_ST_ORIGIN_NOT_FOUND';
    error.details = {
      sku,
      stock_mode: stockMode.mode,
      lot_id: merged.lot_id ?? null,
      lot_code: merged.lot_code ?? null,
      product_id: merged.product_id ?? null,
      grade_id: merged.grade_id ?? null,
      reason,
    };
    throw error;
  }

  applyRetainedIcmsSt(merged, origin, retained);

  if (retained.extrapolated && (origin.source_type || 'INBOUND_NFE') === 'INBOUND_NFE') {
    console.warn('[BUDGET NFE][ICMS-ST EXTRAPOLADO]', {
      sku,
      cst,
      inbound_item_id: origin.inbound_item_id,
      inbound_id: origin.inbound_id,
      entry_base_quantity: origin.entry_base_quantity,
      sale_base_quantity: retained.sale_base_quantity,
      proportion: retained.proportion,
      detail:
        'A quantidade vendida excede a quantidade da nota de entrada usada '
        + 'como origem. O ICMS-ST retido foi calculado por unidade e '
        + 'multiplicado pela quantidade vendida.',
    });
  }

  console.log('[BUDGET NFE][ICMS-ST ORIGIN RESOLVED]', {
    sku,
    cst,
    source_type: origin.source_type || 'INBOUND_NFE',
    inbound_item_id: origin.inbound_item_id ?? null,
    inbound_id: origin.inbound_id ?? null,
    rule_id: origin.rule_id ?? null,
    source_cst: origin.source_cst,
    source_values_from: origin.source_values_from,
    entry_base_quantity: origin.entry_base_quantity,
    sale_base_quantity: retained.sale_base_quantity,
    vBCSTRet: retained.vBCSTRet,
    pST: retained.pST,
    vICMSSubstituto: retained.vICMSSubstituto,
    vICMSSTRet: retained.vICMSSTRet,
    vFCPSTRet: retained.vFCPSTRet,
  });

  return merged;
}

export async function getBudgetFiscalItems(budgetId) {
  const { rows } = await pool.query(
    `
      SELECT
        bi.budget_item_id,
        bi.budget_id,
        bi.product_code,
        bi.barcode_id,
        pbc.barcode,
        bi.description,
        bi.manufacturer_ref,
        bi.grade_id,
        bi.lot_id,
        psl.lot_code,
        g.grade,
        bi.unit_code,
        bi.conversion_factor,
        bi.quantity,
        bi.unit_price,
        bi.discount_value,

        p.product_id,
        p.product_stock_id,

        pf.products_fiscal_id,
        pf.fiscal_classification_id,
        pf.version AS fiscal_version,
        pf.effective_from AS fiscal_effective_from,
        pf.effective_to AS fiscal_effective_to,
        pf.source_system AS fiscal_source_system,
        pf.source_reference AS fiscal_source_reference,
        pf.extra_payload AS product_fiscal_extra_payload,

        fc.classification_name,
        fc.description AS classification_description,
        fc.ncm_code AS ncm,
        fc.ncm_description,
        fc.ex_tipi,
        fc.cest_code AS cest,
        fc.cest_description,

        fp.fiscal_profile_id,
        fp.profile_name,
        fp.description AS profile_description,
        fp.icms_cst,
        fp.icms_rate,
        fp.cfop_entry,
        fp.cfop_exit,
        fp.origin_code,
        fp.pis_cst,
        fp.pis_rate,
        fp.cofins_cst,
        fp.cofins_rate,
        fp.benefit_code,

        fc.is_cst,
        fc.is_classification,
        fc.is_rate,
        fc.is_specific_rate,
        fc.is_unit,
        fc.ibscbs_cst,
        fc.ibscbs_classification,
        fc.ibs_uf_rate,
        fc.ibs_municipal_rate,
        fc.cbs_rate,
        fc.donation_indicator,
        fc.tax_reform_details

      FROM public."budgetsItems" bi

      LEFT JOIN public.grades g
        ON g.grade_id = bi.grade_id

      /*
       * Número do lote para o snapshot da tentativa.
       * productsStockLots.lot_code é text e a PK é lot_id (bigint), do mesmo
       * tipo de budgetsItems.lot_id — confirmado no schema em 16/09/2026.
       */
      LEFT JOIN public."productsStockLots" psl
        ON psl.lot_id = bi.lot_id

      LEFT JOIN public.products p
        ON p.product_code = bi.product_code

      LEFT JOIN public."productsBarCode" pbc
        ON pbc.barcode_id = bi.barcode_id
       AND pbc.product_code = bi.product_code

      /*
       * LATERAL com LIMIT 1: se houver mais de um vínculo marcado como
       * is_current para o mesmo product_code, um LEFT JOIN simples duplicaria
       * o item na NF-e (e nos totais). Mesmo padrão já usado em budgetsApi.
       */
      LEFT JOIN LATERAL (
        SELECT pf_current.*
        FROM public."productsFiscalV2" pf_current
        WHERE pf_current.product_code = bi.product_code
          AND pf_current.is_current = TRUE
          AND pf_current.is_active = TRUE
        ORDER BY pf_current.version DESC, pf_current.products_fiscal_id DESC
        LIMIT 1
      ) pf ON TRUE

      LEFT JOIN public."fiscalClassificationV2" fc
        ON fc.fiscal_classification_id = pf.fiscal_classification_id
       AND fc.is_active = TRUE

      LEFT JOIN public."fiscalProfileV2" fp
        ON fp.fiscal_profile_id = fc.fiscal_profile_id
       AND fp.is_active = TRUE

      WHERE bi.budget_id = $1
      ORDER BY bi.budget_item_id ASC
    `,
    [budgetId],
  );

  const baseItems =
    rows
      .map(rowToFiscalBudgetItem)
      .filter(Boolean);

  const stockMode =
    await resolveActiveStockMode();

  console.log(
    '[BUDGET NFE][STOCK_MODE]',
    {
      mode:
        stockMode.mode,

      isSimple:
        stockMode.isSimple,

      isWithLot:
        stockMode.isWithLot,

      source:
        stockMode.feature?.source,
    },
  );

  /*
   * A ordem continua preservada,
   * importante para nItem da NF-e.
   */
  return mapWithConcurrency(
    baseItems,
    ITEM_ENRICHMENT_CONCURRENCY,

    (item) =>
      enrichBudgetItemForNfe(
        item,
        stockMode,
      ),
  );
}

/**
 * Validações obrigatórias antes de montar o payload da NF-e.
 * Usada tanto pelo preview (getBudgetNfePreparedData) quanto pela emissão
 * (issueBudgetNfe) para que as duas rotas nunca divirjam.
 */
export function assertBudgetItemsAreIssuable(items) {
  if (!items.length) {
    const error = new Error('O orçamento não possui itens para emitir a NF-e.');
    error.status = 422;
    error.code = 'BUDGET_WITHOUT_ITEMS';
    throw error;
  }

  const itemsWithoutFiscalConfiguration = items.filter(
    (item) => !item.products_fiscal_id || !item.fiscal_classification_id,
  );

  if (itemsWithoutFiscalConfiguration.length) {
    const skus = itemsWithoutFiscalConfiguration.map((item) => item.sku);

    const error = new Error(
      `Produto(s) sem configuração fiscal ativa: ${skus.join(', ')}.`,
    );
    error.status = 422;
    error.code = 'BUDGET_ITEMS_WITHOUT_FISCAL_CONFIGURATION';
    error.details = { skus };
    throw error;
  }

  return items;
}

// ============================================================================
// PREPARA ORÇAMENTO COMPLETO PARA NF-e / PREVIEW
// ============================================================================

export async function getBudgetNfePreparedData(budgetId) {
  const budget = await getBudgetIssuedData(budgetId);

  const items = await getBudgetFiscalItems(
    budget.budget_id,
  );

  assertBudgetItemsAreIssuable(items);

  return {
    ...budget,

    // IMPORTANTE:
    // substitui os itens crus pelos itens fiscais/enriquecidos.
    items,
  };
}

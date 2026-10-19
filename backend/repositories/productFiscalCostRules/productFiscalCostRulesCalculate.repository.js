// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productFiscalCostRulesCalculate.repository.js — calculateForProduct  ║
// ║ Cálculo centralizado do custo fiscal (PRODUCT_FISCAL_RULE)           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  clean,
  toNullableNumber,
  round,
  normalizePercent,
  normalizeCalculationQuantity,
  normalizeUnitCost,
  normalizeCst,
} from './productFiscalCostRules.sanitizers.js';
import { resolve } from './productFiscalCostRulesResolve.repository.js';

/* ========================================================================== */
/* Calculate Product Fiscal Cost                                              */
/*                                                                            */
/* Purpose:                                                                   */
/*   - centralized backend calculation for the "Atualizar dados fiscais"     */
/*     action in Products / Stock Lot;                                        */
/*   - does NOT claim the calculated values came from an inbound NF-e;        */
/*   - source is always PRODUCT_FISCAL_RULE.                                  */
/*                                                                            */
/* The calculation uses the resolved rule hierarchy from resolve().           */
/* ========================================================================== */

export async function calculateForProduct(
  productCode,
  {
    unitCost = null,
    quantity = 1,
  } = {},
  client = pool,
) {
  const code = clean(productCode);

  if (!code) {
    throw new Error('product_code é obrigatório.');
  }

  const resolved = await resolve(code, client);

  if (!resolved) {
    throw new Error(`SKU ${code}: produto não encontrado.`);
  }

  if (!resolved.rule_id || resolved.rule_source === 'NONE') {
    throw new Error(
      `SKU ${code}: nenhuma regra de custo fiscal ativa foi encontrada.`,
    );
  }

  const cost = normalizeUnitCost(
    unitCost,
    resolved.cost_price,
  );

  if (cost == null) {
    throw new Error(
      `SKU ${code}: informe um custo unitário válido para calcular os dados fiscais.`,
    );
  }

  const qty = normalizeCalculationQuantity(quantity);
  const cst = normalizeCst(
    resolved.inbound_cst ??
    resolved.profile_icms_cst,
  );

  const icmsBasePct = normalizePercent(
    resolved.icms_base_pct,
    100,
  );

  const icmsRate = normalizePercent(
    resolved.icms_rate ??
    resolved.profile_icms_rate,
    0,
  );

  const stBasePct = normalizePercent(
    resolved.icms_st_ret_base_pct ??
    resolved.icms_st_base_pct,
    100,
  );

  const stRate = normalizePercent(
    resolved.icms_st_ret_rate ??
    resolved.icms_st_rate,
    0,
  );

  const mvaPct = toNullableNumber(
    resolved.mva_pct,
  );

  const calculationMode =
    clean(resolved.calculation_mode) ||
    'PERCENTUAL';

  const icmsBasePerUnit = round(
    cost * (icmsBasePct / 100),
    4,
  );

  const icmsValuePerUnit = round(
    icmsBasePerUnit * (icmsRate / 100),
    4,
  );

  /*
   * Current rule semantics:
   *   icms_st_base_pct defines the effective ST base percentage.
   *
   * mva_pct remains exposed in the response for the UI/audit, but it is not
   * applied a second time here because the rule already stores the configured
   * ST base percentage. This avoids double-increasing the base.
   */
  const icmsStBasePerUnit = round(
    cost * (stBasePct / 100),
    4,
  );

  const icmsStValuePerUnit = round(
    icmsStBasePerUnit * (stRate / 100),
    4,
  );

  const icmsBaseTotal = round(
    icmsBasePerUnit * qty,
    2,
  );

  const icmsValueTotal = round(
    icmsValuePerUnit * qty,
    2,
  );

  const icmsStBaseTotal = round(
    icmsStBasePerUnit * qty,
    2,
  );

  const icmsStValueTotal = round(
    icmsStValuePerUnit * qty,
    2,
  );

  return {
    ok: true,

    source: 'PRODUCT_FISCAL_RULE',
    source_label: 'Regra fiscal do produto',

    product_code: code,
    description: resolved.description ?? null,

    rule_id: Number(resolved.rule_id),
    rule_source: resolved.rule_source,
    calculation_mode: calculationMode,

    products_fiscal_id:
      toNullableNumber(resolved.products_fiscal_id),

    fiscal_classification_id:
      toNullableNumber(resolved.fiscal_classification_id),

    fiscal_profile_id:
      toNullableNumber(resolved.fiscal_profile_id),

    classification_name:
      resolved.classification_name ?? null,

    profile_name:
      resolved.profile_name ?? null,

    inbound_cst: cst,

    unit_cost: round(cost, 6),
    quantity: qty,

    /* ------------------------------------------------------------------ */
    /* Values used by the upper "Origem fiscal" panel                    */
    /* ------------------------------------------------------------------ */

    icms_base_pct: icmsBasePct,
    icms_rate: icmsRate,
    icms_base: icmsBaseTotal,
    icms_value: icmsValueTotal,

    mva_pct: mvaPct,

    icms_st_base_pct: stBasePct,
    icms_st_rate: stRate,
    icms_st_base: icmsStBaseTotal,
    icms_st_value: icmsStValueTotal,

    /* ------------------------------------------------------------------ */
    /* Unit values used by "Fração fiscal por unidade"                    */
    /* ------------------------------------------------------------------ */

    fiscal_per_unit: {
      icms_base: icmsBasePerUnit,
      icms_value: icmsValuePerUnit,
      icms_st_base: icmsStBasePerUnit,
      icms_st_value: icmsStValuePerUnit,
    },

    /* ------------------------------------------------------------------ */
    /* Proportional preview for the operation quantity                    */
    /* ------------------------------------------------------------------ */

    proportional: {
      quantity: qty,
      icms_base: icmsBaseTotal,
      icms_value: icmsValueTotal,
      icms_st_base: icmsStBaseTotal,
      icms_st_value: icmsStValueTotal,
    },

    /* ------------------------------------------------------------------ */
    /* Other rule rates                                                    */
    /* ------------------------------------------------------------------ */

    ipi_rate:
      toNullableNumber(resolved.ipi_rate),

    pis_rate:
      toNullableNumber(
        resolved.pis_rate ??
        resolved.profile_pis_rate,
      ),

    cofins_rate:
      toNullableNumber(
        resolved.cofins_rate ??
        resolved.profile_cofins_rate,
      ),

    notes:
      resolved.notes ?? null,
  };
}

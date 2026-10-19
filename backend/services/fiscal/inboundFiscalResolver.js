'use strict';

import productFiscalCostRulesApi from '../../repositories/productFiscalCostRules/productFiscalCostRules.index.js';
import { calculateInboundFiscal } from './inboundFiscalCalculator.js';

const present = (v) => v !== null && v !== undefined && v !== '';
const pick = (original, fallback) => (present(original) ? original : fallback);

export async function resolveInboundFiscal({ productCode, inboundItem = null, quantity = 1, client } = {}) {
  if (!productCode) throw new Error('productCode é obrigatório.');

  const rule = await productFiscalCostRulesApi.resolve(productCode, client);
  const costPrice = Number(rule?.cost_price || inboundItem?.unit_price || 0);

  const calculated = rule?.rule_id
    ? calculateInboundFiscal({
        costPrice,
        quantity,
        icmsBasePct: rule.icms_base_pct ?? 100,
        icmsRate: rule.icms_rate ?? rule.profile_icms_rate ?? 0,
        mvaPct: rule.mva_pct ?? 0,
        icmsStBasePct: rule.icms_st_base_pct ?? 100,
        icmsStRate: rule.icms_st_rate ?? 0,
      })
    : null;

  const resolved = {
    cst: pick(inboundItem?.cst ?? inboundItem?.icms_cst, rule?.inbound_cst ?? rule?.profile_icms_cst),
    icms_base: pick(inboundItem?.icms_base ?? inboundItem?.vbc, calculated?.vBC),
    icms_rate: pick(inboundItem?.icms_rate ?? inboundItem?.picms, rule?.icms_rate ?? rule?.profile_icms_rate),
    icms_value: pick(inboundItem?.icms ?? inboundItem?.vicms, calculated?.vICMS),
    icms_st_base: pick(inboundItem?.icms_st_base ?? inboundItem?.vbcst, calculated?.vBCST),
    icms_st_rate: pick(inboundItem?.icms_st_rate ?? inboundItem?.picmsst, rule?.icms_st_rate),
    icms_st_value: pick(inboundItem?.icms_st_value ?? inboundItem?.vicmsst, calculated?.vICMSST),
  };

  const hasInbound = Object.values(inboundItem || {}).some(present);
  return {
    product_code: productCode,
    source: hasInbound ? (rule?.rule_id ? 'NFE_WITH_FALLBACK' : 'NFE') : (rule?.rule_source || 'NONE'),
    rule,
    calculated,
    resolved,
  };
}

export default { resolveInboundFiscal };

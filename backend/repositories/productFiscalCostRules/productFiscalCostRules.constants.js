// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productFiscalCostRules.constants.js — tabela e projeção              ║
// ║ Regras de custo fiscal por produto                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import PRODUCT_FISCAL_COST_RULES_SCHEMA, { PRODUCT_FISCAL_COST_RULES_TABLE } from './productFiscalCostRules.catalog.js';

export const TB = PRODUCT_FISCAL_COST_RULES_TABLE;
export const SELECT_COLUMNS = PRODUCT_FISCAL_COST_RULES_SCHEMA.selectProjection;

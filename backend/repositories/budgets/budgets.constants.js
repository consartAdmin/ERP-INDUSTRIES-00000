// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgets.constants.js — Tabelas e aliases usados pelos orçamentos     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { BUDGETS_TABLE } from './budgets.catalog.js';

// ----------------------------------------------------------------------
// Tabelas
// ----------------------------------------------------------------------
// public.budgets is controlled by catalog_schema.budgets.js.
// The other tables remain local until they receive their own catalogs.
export const TB_BUDGETS = BUDGETS_TABLE;
export const ALIAS_B = 'b';

export const TB_BUDGET_ITEMS = 'public."budgetsItems"';
export const ALIAS_BI = 'bi';

export const TB_GRADES = 'public."grades"';
export const ALIAS_G = 'g';

export const TB_PRICES = 'public."prices"';
export const ALIAS_P = 'p';

export const TB_PRICE_COMISSIONS = 'public."priceCommissions"';
export const ALIAS_PC = 'pc';

export const TB_COMMISSIONS = 'public."commissions"';
export const ALIAS_C = 'c';

export const TB_SCFB = 'public."salesCommissionsFromBudgets"';

export const TB_SELLERS = 'public."sellers"';
export const ALIAS_S = 's';

export const TB_SELLER_BY_USER = 'public."sellerByUser"';
export const ALIAS_SBU = 'sbu';

export const TB_PSL = 'public."productsStockLots"';
export const ALIAS_PSL = 'psl';

export const TB_PRODUCTS = 'public.products';
export const ALIAS_PRD = 'prd';

export const TB_PRODUCTS_FISCAL = 'public."productsFiscalV2"';
export const ALIAS_PF = 'pf';
export const TB_FISCAL_CLASSIFICATION = 'public."fiscalClassificationV2"';

export const TB_BUDGETS_SHIPPING = 'public."budgetsShipping"';
export const TB_PRODUCTS_BARCODE = 'public."productsBarCode"';

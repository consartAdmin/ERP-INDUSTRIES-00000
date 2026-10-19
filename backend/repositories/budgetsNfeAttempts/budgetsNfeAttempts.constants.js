// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsNfeAttempts.constants.js — tabelas e colunas                  ║
// ║ Tabelas, colunas graváveis e campos JSON/numéricos                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
    BUDGETS_NFE_ATTEMPTS_TABLE as TB_ATTEMPTS,
    BUDGETS_NFE_ATTEMPTS_INSERT_COLUMNS,
    BUDGETS_NFE_ATTEMPTS_UPDATE_COLUMNS,
} from './budgetsNfeAttempts.catalog.js';

import {
    BUDGETS_NFE_ATTEMPT_ITEMS_TABLE as TB_ITEMS,
    BUDGETS_NFE_ATTEMPT_ITEMS_INSERT_COLUMNS,
} from './budgetsNfeAttemptItems.catalog.js';

import {
    BUDGETS_TABLE as TB_BUDGETS,
} from '../budgets/budgets.catalog.js';

export const TB_STATUS = 'public."nfeStatusMap"';
export const TB_SHIPPING = 'public."budgetsShipping"';
export const TB_INVOICES = 'public."invoicesIssued"';

export const ATTEMPT_WRITABLE = Object.freeze(
    BUDGETS_NFE_ATTEMPTS_UPDATE_COLUMNS.filter(
        (column) => !['budget_id', 'attempt_number'].includes(column),
    ),
);

export const ITEM_WRITABLE = Object.freeze(
    BUDGETS_NFE_ATTEMPT_ITEMS_INSERT_COLUMNS.filter(
        (column) => column !== 'attempt_id',
    ),
);

export const JSON_FIELDS = new Set([
    'request_payload',
    'provider_response',
    'product_fiscal_snapshot',
    'classification_snapshot',
    'fiscal_profile_snapshot',
    'tax_reform_details',
    'tax_calculation',
    'budget_item_snapshot',
    'provider_item_payload',
]);

export const MONEY_FIELDS = new Set([
    'subtotal', 'discount_total', 'freight_value', 'total_amount',
    'quantity', 'taxable_quantity', 'unit_price', 'taxable_unit_price',
    'gross_total', 'discount_amount', 'freight_amount', 'insurance_amount',
    'other_expenses_amount', 'net_total', 'icms_rate', 'pis_rate',
    'cofins_rate', 'icms_base', 'icms_base_reduction_pct',
    'icms_effective_rate', 'icms_value', 'icms_st_mva_pct',
    'icms_st_base_reduction_pct', 'icms_st_base', 'icms_st_rate',
    'icms_st_value', 'icms_st_retained_base', 'icms_st_retained_rate',
    'icms_st_retained_value', 'fcp_base', 'fcp_rate', 'fcp_value',
    'fcp_st_base', 'fcp_st_rate', 'fcp_st_value', 'pis_base',
    'pis_effective_rate', 'pis_value', 'cofins_base',
    'cofins_effective_rate', 'cofins_value', 'is_rate', 'is_specific_rate',
    'is_base', 'is_quantity', 'is_value', 'ibs_uf_rate',
    'ibs_municipal_rate', 'cbs_rate', 'ibscbs_base',
    'ibs_uf_effective_rate', 'ibs_uf_value',
    'ibs_municipal_effective_rate', 'ibs_municipal_value',
    'ibs_total_value', 'cbs_effective_rate', 'cbs_value',
]);

export {
    TB_ATTEMPTS,
    TB_ITEMS,
    TB_BUDGETS,
    BUDGETS_NFE_ATTEMPTS_INSERT_COLUMNS,
    BUDGETS_NFE_ATTEMPT_ITEMS_INSERT_COLUMNS,
};

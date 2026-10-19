// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.ordersNfeAttempts.js — Catálogo NF-e de pedidos     ║
// ║ CONSART ERP | PostgreSQL | ESM                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const ORDERS_NFE_ATTEMPTS_TABLE = 'public."ordersNfeAttempts"';
export const ORDERS_NFE_ATTEMPT_ITEMS_TABLE = 'public."ordersNfeAttemptItems"';

export const ORDER_NFE_ATTEMPT_COLUMNS = Object.freeze([
    'attempt_id', 'order_id', 'budget_id', 'invoice_id', 'attempt_number',
    'nfe_status_id', 'nfe_number', 'nfe_series', 'nfe_environment',
    'operation_type_id', 'customer_id', 'customer_name', 'customer_tax_id',
    'customer_email', 'customer_phone', 'issue_date', 'subtotal',
    'discount_total', 'freight_value', 'total_amount', 'provider_id',
    'integration_id', 'access_key', 'protocol', 'request_payload',
    'provider_response', 'generated_xml', 'error_code', 'error_message',
    'requested_by', 'requested_at', 'authorized_at', 'rejected_at',
    'last_checked_at', 'created_at', 'updated_at',
]);

export const ORDER_NFE_ATTEMPT_INSERT_COLUMNS = Object.freeze(
    ORDER_NFE_ATTEMPT_COLUMNS.filter((column) => ![
        'attempt_id', 'attempt_number', 'requested_at', 'created_at', 'updated_at',
    ].includes(column)),
);

export const ORDER_NFE_ATTEMPT_UPDATE_COLUMNS = Object.freeze([
    'invoice_id', 'nfe_status_id', 'nfe_number', 'nfe_series',
    'nfe_environment', 'operation_type_id', 'provider_id', 'integration_id',
    'access_key', 'protocol', 'request_payload', 'provider_response',
    'generated_xml', 'error_code', 'error_message', 'authorized_at',
    'rejected_at', 'last_checked_at',
]);

export const ORDER_NFE_ATTEMPT_JSON_COLUMNS = Object.freeze([
    'request_payload', 'provider_response',
]);

export const ORDER_NFE_ATTEMPT_ITEM_COLUMNS = Object.freeze([
    'attempt_item_id', 'attempt_id', 'order_item_id', 'item_number',
    'product_id', 'product_code', 'barcode', 'description',
    'products_fiscal_id', 'fiscal_classification_id', 'fiscal_profile_id',
    'fiscal_version', 'fiscal_effective_from', 'fiscal_effective_to',
    'fiscal_source_system', 'fiscal_source_reference', 'classification_name',
    'classification_description', 'ncm_code', 'ncm_description', 'ex_tipi',
    'cest_code', 'cest_description', 'commercial_unit', 'taxable_unit',
    'is_unit', 'quantity', 'taxable_quantity', 'unit_price',
    'taxable_unit_price', 'gross_total', 'discount_amount', 'freight_amount',
    'insurance_amount', 'other_expenses_amount', 'net_total',
    'included_in_invoice_total', 'product_stock_id', 'lot_id', 'lot_number',
    'manufacturing_date', 'expiration_date', 'fiscal_profile_name',
    'fiscal_profile_description', 'origin_code', 'icms_cst', 'icms_rate',
    'cfop_entry', 'cfop_exit', 'cfop_used', 'pis_cst', 'pis_rate',
    'cofins_cst', 'cofins_rate', 'benefit_code', 'icms_base',
    'icms_base_reduction_pct', 'icms_effective_rate', 'icms_value',
    'icms_st_modality', 'icms_st_mva_pct', 'icms_st_base_reduction_pct',
    'icms_st_base', 'icms_st_rate', 'icms_st_value',
    'icms_st_retained_base', 'icms_st_retained_rate',
    'icms_st_retained_value', 'fcp_base', 'fcp_rate', 'fcp_value',
    'fcp_st_base', 'fcp_st_rate', 'fcp_st_value', 'pis_base',
    'pis_effective_rate', 'pis_value', 'cofins_base',
    'cofins_effective_rate', 'cofins_value', 'is_cst', 'is_classification',
    'is_rate', 'is_specific_rate', 'is_base', 'is_quantity', 'is_value',
    'ibscbs_cst', 'ibscbs_classification', 'ibs_uf_rate',
    'ibs_municipal_rate', 'cbs_rate', 'donation_indicator', 'ibscbs_base',
    'ibs_uf_effective_rate', 'ibs_uf_value',
    'ibs_municipal_effective_rate', 'ibs_municipal_value', 'ibs_total_value',
    'cbs_effective_rate', 'cbs_value', 'product_fiscal_snapshot',
    'classification_snapshot', 'fiscal_profile_snapshot',
    'tax_reform_details', 'tax_calculation', 'order_item_snapshot',
    'provider_item_payload', 'created_at',
]);

export const ORDER_NFE_ATTEMPT_ITEM_INSERT_COLUMNS = Object.freeze(
    ORDER_NFE_ATTEMPT_ITEM_COLUMNS.filter((column) => ![
        'attempt_item_id', 'attempt_id', 'created_at',
    ].includes(column)),
);

export const ORDER_NFE_ATTEMPT_ITEM_JSON_COLUMNS = Object.freeze([
    'product_fiscal_snapshot', 'classification_snapshot',
    'fiscal_profile_snapshot', 'tax_reform_details', 'tax_calculation',
    'order_item_snapshot', 'provider_item_payload',
]);

export const ordersNfeAttemptsSchema = Object.freeze({
    table: ORDERS_NFE_ATTEMPTS_TABLE,
    primaryKey: 'attempt_id',
    parentKey: 'order_id',
    columns: ORDER_NFE_ATTEMPT_COLUMNS,
    insertColumns: ORDER_NFE_ATTEMPT_INSERT_COLUMNS,
    updateColumns: ORDER_NFE_ATTEMPT_UPDATE_COLUMNS,
    jsonColumns: ORDER_NFE_ATTEMPT_JSON_COLUMNS,
    items: Object.freeze({
        table: ORDERS_NFE_ATTEMPT_ITEMS_TABLE,
        primaryKey: 'attempt_item_id',
        foreignKey: 'attempt_id',
        sourceKey: 'order_item_id',
        columns: ORDER_NFE_ATTEMPT_ITEM_COLUMNS,
        insertColumns: ORDER_NFE_ATTEMPT_ITEM_INSERT_COLUMNS,
        jsonColumns: ORDER_NFE_ATTEMPT_ITEM_JSON_COLUMNS,
    }),
});

export default ordersNfeAttemptsSchema;

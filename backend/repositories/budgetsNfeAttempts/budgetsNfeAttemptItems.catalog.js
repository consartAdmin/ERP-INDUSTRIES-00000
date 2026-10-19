// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.budgetsNfeAttemptItems.js — PostgreSQL schema catalog║
// ║ CONSART ERP | Table: public."budgetsNfeAttemptItems"                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

// ======================================================================
// 1. TABLE IDENTIFICATION
// ======================================================================

export const BUDGETS_NFE_ATTEMPT_ITEMS_SCHEMA_NAME = 'public';

export const BUDGETS_NFE_ATTEMPT_ITEMS_TABLE_NAME =
    'budgetsNfeAttemptItems';

export const BUDGETS_NFE_ATTEMPT_ITEMS_TABLE =
    `${BUDGETS_NFE_ATTEMPT_ITEMS_SCHEMA_NAME}."${BUDGETS_NFE_ATTEMPT_ITEMS_TABLE_NAME}"`;

export const BUDGETS_NFE_ATTEMPT_ITEMS_PRIMARY_KEY =
    'attempt_item_id';


// ======================================================================
// 2. COLUMN DEFINITIONS
// ======================================================================

export const BUDGETS_NFE_ATTEMPT_ITEMS_COLUMNS = Object.freeze({

    attempt_item_id: {
        name: 'attempt_item_id',
        type: 'bigint',
        nullable: false,
        primaryKey: true,
        identity: true,
        generated: true,
    },

    attempt_id: {
        name: 'attempt_id',
        type: 'bigint',
        nullable: false,
    },

    budget_item_id: {
        name: 'budget_item_id',
        type: 'bigint',
        nullable: true,
    },

    item_number: {
        name: 'item_number',
        type: 'integer',
        nullable: false,
    },

    product_id: {
        name: 'product_id',
        type: 'bigint',
        nullable: true,
    },

    product_code: {
        name: 'product_code',
        type: 'varchar',
        length: 60,
        nullable: false,
    },

    barcode: {
        name: 'barcode',
        type: 'varchar',
        length: 30,
        nullable: true,
    },

    description: {
        name: 'description',
        type: 'varchar',
        length: 500,
        nullable: false,
    },

    products_fiscal_id: {
        name: 'products_fiscal_id',
        type: 'bigint',
        nullable: true,
    },

    fiscal_classification_id: {
        name: 'fiscal_classification_id',
        type: 'integer',
        nullable: true,
    },

    fiscal_profile_id: {
        name: 'fiscal_profile_id',
        type: 'integer',
        nullable: true,
    },

    fiscal_version: {
        name: 'fiscal_version',
        type: 'integer',
        nullable: true,
    },

    fiscal_effective_from: {
        name: 'fiscal_effective_from',
        type: 'timestamptz',
        nullable: true,
    },

    fiscal_effective_to: {
        name: 'fiscal_effective_to',
        type: 'timestamptz',
        nullable: true,
    },

    fiscal_source_system: {
        name: 'fiscal_source_system',
        type: 'varchar',
        length: 60,
        nullable: true,
    },

    fiscal_source_reference: {
        name: 'fiscal_source_reference',
        type: 'varchar',
        length: 120,
        nullable: true,
    },

    classification_name: {
        name: 'classification_name',
        type: 'varchar',
        length: 150,
        nullable: true,
    },

    classification_description: {
        name: 'classification_description',
        type: 'text',
        nullable: true,
    },

    ncm_code: {
        name: 'ncm_code',
        type: 'varchar',
        length: 10,
        nullable: true,
    },

    ncm_description: {
        name: 'ncm_description',
        type: 'text',
        nullable: true,
    },

    ex_tipi: {
        name: 'ex_tipi',
        type: 'varchar',
        length: 3,
        nullable: true,
    },

    cest_code: {
        name: 'cest_code',
        type: 'varchar',
        length: 10,
        nullable: true,
    },

    cest_description: {
        name: 'cest_description',
        type: 'text',
        nullable: true,
    },

    commercial_unit: {
        name: 'commercial_unit',
        type: 'varchar',
        length: 10,
        nullable: true,
    },

    taxable_unit: {
        name: 'taxable_unit',
        type: 'varchar',
        length: 10,
        nullable: true,
    },

    is_unit: {
        name: 'is_unit',
        type: 'varchar',
        length: 6,
        nullable: true,
    },

    quantity: {
        name: 'quantity',
        type: 'numeric',
        precision: 18,
        scale: 6,
        nullable: false,
        default: 0,
    },

    taxable_quantity: {
        name: 'taxable_quantity',
        type: 'numeric',
        precision: 18,
        scale: 6,
        nullable: true,
    },

    unit_price: {
        name: 'unit_price',
        type: 'numeric',
        precision: 18,
        scale: 10,
        nullable: false,
        default: 0,
    },

    taxable_unit_price: {
        name: 'taxable_unit_price',
        type: 'numeric',
        precision: 18,
        scale: 10,
        nullable: true,
    },

    gross_total: {
        name: 'gross_total',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    discount_amount: {
        name: 'discount_amount',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    freight_amount: {
        name: 'freight_amount',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    insurance_amount: {
        name: 'insurance_amount',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    other_expenses_amount: {
        name: 'other_expenses_amount',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    net_total: {
        name: 'net_total',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    included_in_invoice_total: {
        name: 'included_in_invoice_total',
        type: 'boolean',
        nullable: false,
        default: true,
    },

    product_stock_id: {
        name: 'product_stock_id',
        type: 'bigint',
        nullable: true,
    },

    lot_id: {
        name: 'lot_id',
        type: 'bigint',
        nullable: true,
    },

    lot_number: {
        name: 'lot_number',
        type: 'varchar',
        length: 100,
        nullable: true,
    },

    manufacturing_date: {
        name: 'manufacturing_date',
        type: 'date',
        nullable: true,
    },

    expiration_date: {
        name: 'expiration_date',
        type: 'date',
        nullable: true,
    },

    fiscal_profile_name: {
        name: 'fiscal_profile_name',
        type: 'varchar',
        length: 100,
        nullable: true,
    },

    fiscal_profile_description: {
        name: 'fiscal_profile_description',
        type: 'text',
        nullable: true,
    },

    origin_code: {
        name: 'origin_code',
        type: 'varchar',
        length: 2,
        nullable: true,
    },

    icms_cst: {
        name: 'icms_cst',
        type: 'varchar',
        length: 3,
        nullable: true,
    },

    icms_rate: {
        name: 'icms_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    cfop_entry: {
        name: 'cfop_entry',
        type: 'varchar',
        length: 10,
        nullable: true,
    },

    cfop_exit: {
        name: 'cfop_exit',
        type: 'varchar',
        length: 10,
        nullable: true,
    },

    cfop_used: {
        name: 'cfop_used',
        type: 'varchar',
        length: 10,
        nullable: true,
    },

    pis_cst: {
        name: 'pis_cst',
        type: 'varchar',
        length: 3,
        nullable: true,
    },

    pis_rate: {
        name: 'pis_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    cofins_cst: {
        name: 'cofins_cst',
        type: 'varchar',
        length: 3,
        nullable: true,
    },

    cofins_rate: {
        name: 'cofins_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    benefit_code: {
        name: 'benefit_code',
        type: 'varchar',
        length: 20,
        nullable: true,
    },

    icms_base: {
        name: 'icms_base',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    icms_base_reduction_pct: {
        name: 'icms_base_reduction_pct',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    icms_effective_rate: {
        name: 'icms_effective_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    icms_value: {
        name: 'icms_value',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    icms_st_modality: {
        name: 'icms_st_modality',
        type: 'varchar',
        length: 2,
        nullable: true,
    },

    icms_st_mva_pct: {
        name: 'icms_st_mva_pct',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    icms_st_base_reduction_pct: {
        name: 'icms_st_base_reduction_pct',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    icms_st_base: {
        name: 'icms_st_base',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    icms_st_rate: {
        name: 'icms_st_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    icms_st_value: {
        name: 'icms_st_value',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    icms_st_retained_base: {
        name: 'icms_st_retained_base',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    icms_st_retained_rate: {
        name: 'icms_st_retained_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    icms_st_retained_value: {
        name: 'icms_st_retained_value',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    fcp_base: {
        name: 'fcp_base',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    fcp_rate: {
        name: 'fcp_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    fcp_value: {
        name: 'fcp_value',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    fcp_st_base: {
        name: 'fcp_st_base',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    fcp_st_rate: {
        name: 'fcp_st_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    fcp_st_value: {
        name: 'fcp_st_value',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    pis_base: {
        name: 'pis_base',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    pis_effective_rate: {
        name: 'pis_effective_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    pis_value: {
        name: 'pis_value',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    cofins_base: {
        name: 'cofins_base',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    cofins_effective_rate: {
        name: 'cofins_effective_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    cofins_value: {
        name: 'cofins_value',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    is_cst: {
        name: 'is_cst',
        type: 'varchar',
        length: 3,
        nullable: true,
    },

    is_classification: {
        name: 'is_classification',
        type: 'varchar',
        length: 10,
        nullable: true,
    },

    is_rate: {
        name: 'is_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    is_specific_rate: {
        name: 'is_specific_rate',
        type: 'numeric',
        precision: 15,
        scale: 6,
        nullable: false,
        default: 0,
    },

    is_base: {
        name: 'is_base',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    is_quantity: {
        name: 'is_quantity',
        type: 'numeric',
        precision: 18,
        scale: 6,
        nullable: false,
        default: 0,
    },

    is_value: {
        name: 'is_value',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    ibscbs_cst: {
        name: 'ibscbs_cst',
        type: 'varchar',
        length: 3,
        nullable: true,
    },

    ibscbs_classification: {
        name: 'ibscbs_classification',
        type: 'varchar',
        length: 6,
        nullable: true,
    },

    ibs_uf_rate: {
        name: 'ibs_uf_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    ibs_municipal_rate: {
        name: 'ibs_municipal_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    cbs_rate: {
        name: 'cbs_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    donation_indicator: {
        name: 'donation_indicator',
        type: 'smallint',
        nullable: false,
        default: 1,
        allowedValues: [0, 1],
    },

    ibscbs_base: {
        name: 'ibscbs_base',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    ibs_uf_effective_rate: {
        name: 'ibs_uf_effective_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    ibs_uf_value: {
        name: 'ibs_uf_value',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    ibs_municipal_effective_rate: {
        name: 'ibs_municipal_effective_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    ibs_municipal_value: {
        name: 'ibs_municipal_value',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    ibs_total_value: {
        name: 'ibs_total_value',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    cbs_effective_rate: {
        name: 'cbs_effective_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    cbs_value: {
        name: 'cbs_value',
        type: 'numeric',
        precision: 18,
        scale: 4,
        nullable: false,
        default: 0,
    },

    product_fiscal_snapshot: {
        name: 'product_fiscal_snapshot',
        type: 'jsonb',
        nullable: false,
        default: {},
    },

    classification_snapshot: {
        name: 'classification_snapshot',
        type: 'jsonb',
        nullable: false,
        default: {},
    },

    fiscal_profile_snapshot: {
        name: 'fiscal_profile_snapshot',
        type: 'jsonb',
        nullable: false,
        default: {},
    },

    tax_reform_details: {
        name: 'tax_reform_details',
        type: 'jsonb',
        nullable: false,
        default: {},
    },

    tax_calculation: {
        name: 'tax_calculation',
        type: 'jsonb',
        nullable: false,
        default: {},
    },

    budget_item_snapshot: {
        name: 'budget_item_snapshot',
        type: 'jsonb',
        nullable: false,
        default: {},
    },

    provider_item_payload: {
        name: 'provider_item_payload',
        type: 'jsonb',
        nullable: false,
        default: {},
    },

    created_at: {
        name: 'created_at',
        type: 'timestamptz',
        nullable: false,
        generated: true,
        default: 'now()',
    },
});


// ======================================================================
// 3. COLUMN NAMES
// ======================================================================

export const BUDGETS_NFE_ATTEMPT_ITEMS_COLUMN_NAMES =
    Object.freeze(
        Object.keys(
            BUDGETS_NFE_ATTEMPT_ITEMS_COLUMNS
        )
    );


// ======================================================================
// 4. SELECT COLUMNS
// ======================================================================

export const BUDGETS_NFE_ATTEMPT_ITEMS_SELECT_COLUMNS =
    Object.freeze([
        ...BUDGETS_NFE_ATTEMPT_ITEMS_COLUMN_NAMES,
    ]);


// ======================================================================
// 5. INSERT COLUMNS
//
// Excluded:
// - attempt_item_id -> identity
// - created_at      -> now()
// ======================================================================

export const BUDGETS_NFE_ATTEMPT_ITEMS_INSERT_COLUMNS =
    Object.freeze(
        BUDGETS_NFE_ATTEMPT_ITEMS_COLUMN_NAMES.filter(
            (column) =>
                ![
                    'attempt_item_id',
                    'created_at',
                ].includes(column)
        )
    );


// ======================================================================
// 6. UPDATE COLUMNS
//
// attempt_id / item_number are kept writable because the physical
// table allows it. The API may choose to protect them at service level.
// ======================================================================

export const BUDGETS_NFE_ATTEMPT_ITEMS_UPDATE_COLUMNS =
    Object.freeze(
        BUDGETS_NFE_ATTEMPT_ITEMS_COLUMN_NAMES.filter(
            (column) =>
                ![
                    'attempt_item_id',
                    'created_at',
                ].includes(column)
        )
    );


// ======================================================================
// 7. NOT NULL COLUMNS
// ======================================================================

export const BUDGETS_NFE_ATTEMPT_ITEMS_NOT_NULL_COLUMNS =
    Object.freeze([
        'attempt_item_id',
        'attempt_id',
        'item_number',
        'product_code',
        'description',

        'quantity',
        'unit_price',
        'gross_total',
        'discount_amount',
        'freight_amount',
        'insurance_amount',
        'other_expenses_amount',
        'net_total',

        'included_in_invoice_total',

        'icms_rate',
        'pis_rate',
        'cofins_rate',

        'icms_base',
        'icms_base_reduction_pct',
        'icms_effective_rate',
        'icms_value',

        'icms_st_mva_pct',
        'icms_st_base_reduction_pct',
        'icms_st_base',
        'icms_st_rate',
        'icms_st_value',
        'icms_st_retained_base',
        'icms_st_retained_rate',
        'icms_st_retained_value',

        'fcp_base',
        'fcp_rate',
        'fcp_value',
        'fcp_st_base',
        'fcp_st_rate',
        'fcp_st_value',

        'pis_base',
        'pis_effective_rate',
        'pis_value',

        'cofins_base',
        'cofins_effective_rate',
        'cofins_value',

        'is_rate',
        'is_specific_rate',
        'is_base',
        'is_quantity',
        'is_value',

        'ibs_uf_rate',
        'ibs_municipal_rate',
        'cbs_rate',

        'donation_indicator',

        'ibscbs_base',
        'ibs_uf_effective_rate',
        'ibs_uf_value',
        'ibs_municipal_effective_rate',
        'ibs_municipal_value',
        'ibs_total_value',
        'cbs_effective_rate',
        'cbs_value',

        'product_fiscal_snapshot',
        'classification_snapshot',
        'fiscal_profile_snapshot',
        'tax_reform_details',
        'tax_calculation',
        'budget_item_snapshot',
        'provider_item_payload',

        'created_at',
    ]);


// ======================================================================
// 8. API REQUIRED COLUMNS
// ======================================================================

export const BUDGETS_NFE_ATTEMPT_ITEMS_API_REQUIRED_COLUMNS =
    Object.freeze([
        'attempt_id',
        'item_number',
        'product_code',
        'description',
    ]);


// ======================================================================
// 9. JSON FIELDS
// ======================================================================

export const BUDGETS_NFE_ATTEMPT_ITEMS_JSON_FIELDS =
    Object.freeze([
        'product_fiscal_snapshot',
        'classification_snapshot',
        'fiscal_profile_snapshot',
        'tax_reform_details',
        'tax_calculation',
        'budget_item_snapshot',
        'provider_item_payload',
    ]);


// ======================================================================
// 10. DEFAULTS
// ======================================================================

export const BUDGETS_NFE_ATTEMPT_ITEMS_DEFAULTS =
    Object.freeze({

        quantity: 0,
        unit_price: 0,

        gross_total: 0,
        discount_amount: 0,
        freight_amount: 0,
        insurance_amount: 0,
        other_expenses_amount: 0,
        net_total: 0,

        included_in_invoice_total: true,

        icms_rate: 0,
        pis_rate: 0,
        cofins_rate: 0,

        icms_base: 0,
        icms_base_reduction_pct: 0,
        icms_effective_rate: 0,
        icms_value: 0,

        icms_st_mva_pct: 0,
        icms_st_base_reduction_pct: 0,
        icms_st_base: 0,
        icms_st_rate: 0,
        icms_st_value: 0,
        icms_st_retained_base: 0,
        icms_st_retained_rate: 0,
        icms_st_retained_value: 0,

        fcp_base: 0,
        fcp_rate: 0,
        fcp_value: 0,

        fcp_st_base: 0,
        fcp_st_rate: 0,
        fcp_st_value: 0,

        pis_base: 0,
        pis_effective_rate: 0,
        pis_value: 0,

        cofins_base: 0,
        cofins_effective_rate: 0,
        cofins_value: 0,

        is_rate: 0,
        is_specific_rate: 0,
        is_base: 0,
        is_quantity: 0,
        is_value: 0,

        ibs_uf_rate: 0,
        ibs_municipal_rate: 0,
        cbs_rate: 0,

        donation_indicator: 1,

        ibscbs_base: 0,
        ibs_uf_effective_rate: 0,
        ibs_uf_value: 0,
        ibs_municipal_effective_rate: 0,
        ibs_municipal_value: 0,
        ibs_total_value: 0,
        cbs_effective_rate: 0,
        cbs_value: 0,

        product_fiscal_snapshot: {},
        classification_snapshot: {},
        fiscal_profile_snapshot: {},
        tax_reform_details: {},
        tax_calculation: {},
        budget_item_snapshot: {},
        provider_item_payload: {},
    });


// ======================================================================
// 11. CHECK CONSTRAINTS
// ======================================================================

export const BUDGETS_NFE_ATTEMPT_ITEMS_CHECK_CONSTRAINTS =
    Object.freeze({

        ck_budgetsNfeAttemptItems_donation: {
            columns: ['donation_indicator'],
            rule: 'IN',
            values: [0, 1],
        },

        ck_budgetsNfeAttemptItems_item_number: {
            columns: ['item_number'],
            rule: 'GREATER_THAN_ZERO',
        },

        ck_budgetsNfeAttemptItems_quantity: {
            columns: ['quantity'],
            rule: 'GREATER_THAN_OR_EQUAL_TO_ZERO',
        },

        ck_budgetsNfeAttemptItems_taxable_quantity: {
            columns: ['taxable_quantity'],
            rule: 'NULL_OR_GREATER_THAN_OR_EQUAL_TO_ZERO',
        },

        ck_budgetsNfeAttemptItems_unit_price: {
            columns: ['unit_price'],
            rule: 'GREATER_THAN_OR_EQUAL_TO_ZERO',
        },

        ck_budgetsNfeAttemptItems_values: {
            columns: [
                'gross_total',
                'discount_amount',
                'freight_amount',
                'insurance_amount',
                'other_expenses_amount',
                'net_total',
            ],
            rule: 'GREATER_THAN_OR_EQUAL_TO_ZERO',
        },

        ck_budgetsNfeAttemptItems_json: {
            columns:
                BUDGETS_NFE_ATTEMPT_ITEMS_JSON_FIELDS,

            rule:
                'JSON_OBJECT',
        },
    });


// ======================================================================
// 12. FOREIGN KEYS
// ======================================================================

export const BUDGETS_NFE_ATTEMPT_ITEMS_FOREIGN_KEYS =
    Object.freeze({

        attempt_id: {
            constraint:
                'fk_budgetsNfeAttemptItems_attempt',

            column:
                'attempt_id',

            references: {
                schema: 'public',
                table: 'budgetsNfeAttempts',
                column: 'attempt_id',
            },

            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },

        fiscal_classification_id: {
            constraint:
                'fk_budgetsNfeAttemptItems_classification',

            column:
                'fiscal_classification_id',

            references: {
                schema: 'public',
                table: '"fiscalClassificationV2"',
                column: 'fiscal_classification_id',
            },

            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },

        products_fiscal_id: {
            constraint:
                'fk_budgetsNfeAttemptItems_product_fiscal',

            column:
                'products_fiscal_id',

            references: {
                schema: 'public',
                table: '"productsFiscalV2"',
                column: '"products_fiscal_id',
            },

            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },

        fiscal_profile_id: {
            constraint:
                'fk_budgetsNfeAttemptItems_profile',

            column:
                'fiscal_profile_id',

            references: {
                schema: 'public',
                table: '"fiscalProfileV2"',
                column: 'fiscal_profile_id',
            },

            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
    });


// ======================================================================
// 13. INDEXES
// ======================================================================

export const BUDGETS_NFE_ATTEMPT_ITEMS_INDEXES =
    Object.freeze({

        budgetsNfeAttemptItems_pkey: {
            columns: ['attempt_item_id'],
            primaryKey: true,
            unique: true,
        },

        idx_budgetsNfeAttemptItems_attempt: {
            columns: ['attempt_id'],
        },

        idx_budgetsNfeAttemptItems_budget_item: {
            columns: ['budget_item_id'],
            where: 'budget_item_id IS NOT NULL',
        },

        idx_budgetsNfeAttemptItems_cfop: {
            columns: ['cfop_used'],
            where: 'cfop_used IS NOT NULL',
        },

        idx_budgetsNfeAttemptItems_classification: {
            columns: ['fiscal_classification_id'],
            where: 'fiscal_classification_id IS NOT NULL',
        },

        idx_budgetsNfeAttemptItems_ibscbs: {
            columns: [
                'ibscbs_cst',
                'ibscbs_classification',
            ],
        },

        idx_budgetsNfeAttemptItems_lot: {
            columns: ['lot_id'],
            where: 'lot_id IS NOT NULL',
        },

        idx_budgetsNfeAttemptItems_ncm: {
            columns: ['ncm_code'],
            where: 'ncm_code IS NOT NULL',
        },

        idx_budgetsNfeAttemptItems_product_code: {
            columns: ['product_code'],
        },

        idx_budgetsNfeAttemptItems_product_fiscal: {
            columns: ['products_fiscal_id'],
            where: 'products_fiscal_id IS NOT NULL',
        },

        idx_budgetsNfeAttemptItems_profile: {
            columns: ['fiscal_profile_id'],
            where: 'fiscal_profile_id IS NOT NULL',
        },

        uq_budgetsNfeAttemptItems_number: {
            columns: [
                'attempt_id',
                'item_number',
            ],
            unique: true,
            constraint: true,
        },
    });


// ======================================================================
// 14. SELECT SQL
// ======================================================================

export const BUDGETS_NFE_ATTEMPT_ITEMS_SELECT_SQL =
    BUDGETS_NFE_ATTEMPT_ITEMS_SELECT_COLUMNS
        .map((column) => `ai."${column}"`)
        .join(',\n');


// ======================================================================
// 15. HELPERS
// ======================================================================

function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(
        object,
        key
    );
}


function isPlainObject(value) {
    return (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
    );
}


export function isBudgetsNfeAttemptItemsColumn(column) {
    return Object.prototype.hasOwnProperty.call(
        BUDGETS_NFE_ATTEMPT_ITEMS_COLUMNS,
        String(column || '')
    );
}


export function isBudgetsNfeAttemptItemsInsertColumn(column) {
    return BUDGETS_NFE_ATTEMPT_ITEMS_INSERT_COLUMNS.includes(
        String(column || '')
    );
}


export function isBudgetsNfeAttemptItemsUpdateColumn(column) {
    return BUDGETS_NFE_ATTEMPT_ITEMS_UPDATE_COLUMNS.includes(
        String(column || '')
    );
}


export function getBudgetsNfeAttemptItemsColumnDefinition(
    column
) {
    return (
        BUDGETS_NFE_ATTEMPT_ITEMS_COLUMNS[
        String(column || '')
        ] ||
        null
    );
}


// ======================================================================
// 16. PAYLOAD SANITIZERS
// ======================================================================

export function pickBudgetsNfeAttemptItemsInsertPayload(
    payload = {}
) {

    if (!isPlainObject(payload)) {
        return {};
    }


    const output = {};


    for (
        const column
        of BUDGETS_NFE_ATTEMPT_ITEMS_INSERT_COLUMNS
    ) {

        if (!hasOwn(payload, column)) {
            continue;
        }


        output[column] =
            payload[column];
    }


    return output;
}


export function pickBudgetsNfeAttemptItemsUpdatePayload(
    payload = {}
) {

    if (!isPlainObject(payload)) {
        return {};
    }


    const output = {};


    for (
        const column
        of BUDGETS_NFE_ATTEMPT_ITEMS_UPDATE_COLUMNS
    ) {

        if (!hasOwn(payload, column)) {
            continue;
        }


        output[column] =
            payload[column];
    }


    return output;
}


// ======================================================================
// 17. JSON VALIDATION
// ======================================================================

function isJsonObject(value) {
    return (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
    );
}


export function validateBudgetsNfeAttemptItemsJson(
    payload = {}
) {

    const errors = [];


    for (
        const column
        of BUDGETS_NFE_ATTEMPT_ITEMS_JSON_FIELDS
    ) {

        if (!hasOwn(payload, column)) {
            continue;
        }


        const value =
            payload[column];


        if (!isJsonObject(value)) {
            errors.push({
                field: column,
                message:
                    `${column} deve ser um objeto JSON.`,
            });
        }
    }


    return {
        valid:
            errors.length === 0,

        errors,
    };
}


// ======================================================================
// 18. REQUIRED VALIDATION
// ======================================================================

export function validateBudgetsNfeAttemptItemsRequiredFields(
    payload = {}
) {

    const errors = [];


    if (!isPlainObject(payload)) {

        return {
            valid: false,

            errors: [
                {
                    field: null,
                    message:
                        'Payload de item de tentativa de NF-e inválido.',
                },
            ],
        };
    }


    for (
        const column
        of BUDGETS_NFE_ATTEMPT_ITEMS_API_REQUIRED_COLUMNS
    ) {

        const value =
            payload[column];


        if (
            value === undefined ||
            value === null ||
            (
                typeof value === 'string' &&
                value.trim() === ''
            )
        ) {

            errors.push({
                field: column,
                message:
                    `Campo obrigatório: ${column}.`,
            });
        }
    }


    return {
        valid:
            errors.length === 0,

        errors,
    };
}


// ======================================================================
// 19. NUMERIC VALIDATION
// ======================================================================

export function validateBudgetsNfeAttemptItemsNumericValues(
    payload = {}
) {

    const errors = [];


    if (
        hasOwn(payload, 'item_number')
    ) {

        const value =
            Number(
                payload.item_number
            );


        if (
            !Number.isSafeInteger(value) ||
            value <= 0
        ) {

            errors.push({
                field:
                    'item_number',

                message:
                    'item_number deve ser um inteiro positivo.',
            });
        }
    }


    if (
        hasOwn(payload, 'quantity')
    ) {

        const value =
            Number(
                payload.quantity
            );


        if (
            !Number.isFinite(value) ||
            value < 0
        ) {

            errors.push({
                field:
                    'quantity',

                message:
                    'quantity deve ser um número maior ou igual a zero.',
            });
        }
    }


    if (
        hasOwn(
            payload,
            'taxable_quantity'
        ) &&
        payload.taxable_quantity !== null &&
        payload.taxable_quantity !== undefined &&
        payload.taxable_quantity !== ''
    ) {

        const value =
            Number(
                payload.taxable_quantity
            );


        if (
            !Number.isFinite(value) ||
            value < 0
        ) {

            errors.push({
                field:
                    'taxable_quantity',

                message:
                    'taxable_quantity deve ser nulo ou maior ou igual a zero.',
            });
        }
    }


    if (
        hasOwn(payload, 'unit_price')
    ) {

        const value =
            Number(
                payload.unit_price
            );


        if (
            !Number.isFinite(value) ||
            value < 0
        ) {

            errors.push({
                field:
                    'unit_price',

                message:
                    'unit_price deve ser maior ou igual a zero.',
            });
        }
    }


    const nonNegativeValues = [
        'gross_total',
        'discount_amount',
        'freight_amount',
        'insurance_amount',
        'other_expenses_amount',
        'net_total',
    ];


    for (
        const column
        of nonNegativeValues
    ) {

        if (!hasOwn(payload, column)) {
            continue;
        }


        const value =
            Number(
                payload[column]
            );


        if (
            !Number.isFinite(value) ||
            value < 0
        ) {

            errors.push({
                field:
                    column,

                message:
                    `${column} deve ser maior ou igual a zero.`,
            });
        }
    }


    if (
        hasOwn(
            payload,
            'donation_indicator'
        )
    ) {

        const value =
            Number(
                payload.donation_indicator
            );


        if (
            ![0, 1].includes(value)
        ) {

            errors.push({
                field:
                    'donation_indicator',

                message:
                    'donation_indicator deve ser 0 ou 1.',
            });
        }
    }


    return {
        valid:
            errors.length === 0,

        errors,
    };
}


// ======================================================================
// 20. COMPLETE VALIDATION
// ======================================================================

export function validateBudgetsNfeAttemptItemsPayload(
    payload = {},
    options = {}
) {

    const {
        requireRequiredFields = true,
    } = options;


    const errors = [];


    if (!isPlainObject(payload)) {

        return {
            valid: false,

            errors: [
                {
                    field: null,
                    message:
                        'Payload de item de tentativa de NF-e inválido.',
                },
            ],
        };
    }


    if (requireRequiredFields) {

        const required =
            validateBudgetsNfeAttemptItemsRequiredFields(
                payload
            );


        errors.push(
            ...required.errors
        );
    }


    const numeric =
        validateBudgetsNfeAttemptItemsNumericValues(
            payload
        );


    errors.push(
        ...numeric.errors
    );


    const json =
        validateBudgetsNfeAttemptItemsJson(
            payload
        );


    errors.push(
        ...json.errors
    );


    return {
        valid:
            errors.length === 0,

        errors,
    };
}


// ======================================================================
// 21. PREPARE INSERT
// ======================================================================

export function prepareBudgetsNfeAttemptItemsInsert(
    payload = {}
) {

    const data =
        pickBudgetsNfeAttemptItemsInsertPayload(
            payload
        );


    const validation =
        validateBudgetsNfeAttemptItemsPayload(
            data,
            {
                requireRequiredFields: true,
            }
        );


    return {
        data,
        ...validation,
    };
}


// ======================================================================
// 22. PREPARE UPDATE
// ======================================================================

export function prepareBudgetsNfeAttemptItemsUpdate(
    payload = {}
) {

    const data =
        pickBudgetsNfeAttemptItemsUpdatePayload(
            payload
        );


    const validation =
        validateBudgetsNfeAttemptItemsPayload(
            data,
            {
                requireRequiredFields: false,
            }
        );


    return {
        data,
        ...validation,
    };
}


// ======================================================================
// 23. DEFAULT EXPORT
// ======================================================================

const budgetsNfeAttemptItemsSchema = Object.freeze({

    schema:
        BUDGETS_NFE_ATTEMPT_ITEMS_SCHEMA_NAME,

    table:
        BUDGETS_NFE_ATTEMPT_ITEMS_TABLE_NAME,

    qualifiedTable:
        BUDGETS_NFE_ATTEMPT_ITEMS_TABLE,

    primaryKey:
        BUDGETS_NFE_ATTEMPT_ITEMS_PRIMARY_KEY,


    columns:
        BUDGETS_NFE_ATTEMPT_ITEMS_COLUMNS,

    columnNames:
        BUDGETS_NFE_ATTEMPT_ITEMS_COLUMN_NAMES,

    selectColumns:
        BUDGETS_NFE_ATTEMPT_ITEMS_SELECT_COLUMNS,

    selectSql:
        BUDGETS_NFE_ATTEMPT_ITEMS_SELECT_SQL,

    insertColumns:
        BUDGETS_NFE_ATTEMPT_ITEMS_INSERT_COLUMNS,

    updateColumns:
        BUDGETS_NFE_ATTEMPT_ITEMS_UPDATE_COLUMNS,

    notNullColumns:
        BUDGETS_NFE_ATTEMPT_ITEMS_NOT_NULL_COLUMNS,

    apiRequiredColumns:
        BUDGETS_NFE_ATTEMPT_ITEMS_API_REQUIRED_COLUMNS,

    jsonFields:
        BUDGETS_NFE_ATTEMPT_ITEMS_JSON_FIELDS,

    defaults:
        BUDGETS_NFE_ATTEMPT_ITEMS_DEFAULTS,

    checks:
        BUDGETS_NFE_ATTEMPT_ITEMS_CHECK_CONSTRAINTS,

    foreignKeys:
        BUDGETS_NFE_ATTEMPT_ITEMS_FOREIGN_KEYS,

    indexes:
        BUDGETS_NFE_ATTEMPT_ITEMS_INDEXES,


    helpers: {

        isColumn:
            isBudgetsNfeAttemptItemsColumn,

        isInsertColumn:
            isBudgetsNfeAttemptItemsInsertColumn,

        isUpdateColumn:
            isBudgetsNfeAttemptItemsUpdateColumn,

        getColumnDefinition:
            getBudgetsNfeAttemptItemsColumnDefinition,

        pickInsertPayload:
            pickBudgetsNfeAttemptItemsInsertPayload,

        pickUpdatePayload:
            pickBudgetsNfeAttemptItemsUpdatePayload,

        validateRequiredFields:
            validateBudgetsNfeAttemptItemsRequiredFields,

        validateNumericValues:
            validateBudgetsNfeAttemptItemsNumericValues,

        validateJson:
            validateBudgetsNfeAttemptItemsJson,

        validatePayload:
            validateBudgetsNfeAttemptItemsPayload,

        prepareInsert:
            prepareBudgetsNfeAttemptItemsInsert,

        prepareUpdate:
            prepareBudgetsNfeAttemptItemsUpdate,
    },
});


export default budgetsNfeAttemptItemsSchema;
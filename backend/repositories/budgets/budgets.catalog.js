// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.budgets.js — PostgreSQL schema catalog               ║
// ║ CONSART ERP | Table: public.budgets                                 ║
// ║                                                                      ║
// ║ Purpose                                                              ║
// ║ - Centralize the real database structure of public.budgets           ║
// ║ - Avoid duplicated column names across APIs                          ║
// ║ - Provide metadata for validation, SELECT, INSERT and UPDATE          ║
// ║ - Keep budgetsApi.js synchronized with the PostgreSQL schema          ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

// ──────────────────────────────────────────────────────────────────────
// 1. TABLE IDENTIFICATION
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_SCHEMA_NAME = 'public';

export const BUDGETS_TABLE_NAME = 'budgets';

export const BUDGETS_TABLE = `${BUDGETS_SCHEMA_NAME}.${BUDGETS_TABLE_NAME}`;

export const BUDGETS_PRIMARY_KEY = 'budget_id';


// ──────────────────────────────────────────────────────────────────────
// 2. COLUMN DEFINITIONS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_COLUMNS = Object.freeze({

    budget_id: {
        name: 'budget_id',
        type: 'bigint',
        nullable: false,
        primaryKey: true,
        identity: true,
        generated: true,
        default: null,
    },

    issue_date: {
        name: 'issue_date',
        type: 'date',
        nullable: false,
        default: 'CURRENT_DATE',
    },

    status: {
        name: 'status',
        type: 'varchar',
        length: 40,
        nullable: false,
        default: 'ABERTO',
    },

    customer_id: {
        name: 'customer_id',
        type: 'bigint',
        nullable: true,
        default: null,
    },

    customer_name: {
        name: 'customer_name',
        type: 'varchar',
        length: 200,
        nullable: false,
        default: null,
    },

    customer_tax_id: {
        name: 'customer_tax_id',
        type: 'varchar',
        length: 32,
        nullable: false,
        default: null,
    },

    customer_email: {
        name: 'customer_email',
        type: 'varchar',
        length: 180,
        nullable: true,
        default: null,
    },

    customer_phone: {
        name: 'customer_phone',
        type: 'varchar',
        length: 30,
        nullable: true,
        default: null,
    },

    seller_id: {
        name: 'seller_id',
        type: 'varchar',
        nullable: true,
        default: null,
    },

    price_id: {
        name: 'price_id',
        type: 'integer',
        nullable: true,
        default: null,
    },

    operation_type_id: {
        name: 'operation_type_id',
        type: 'bigint',
        nullable: true,
        default: null,
    },

    payment_form_id: {
        name: 'payment_form_id',
        type: 'bigint',
        nullable: true,
        default: null,
    },

    payment_term_id: {
        name: 'payment_term_id',
        type: 'bigint',
        nullable: true,
        default: null,
    },

    budget_shipping_id: {
        name: 'budget_shipping_id',
        type: 'integer',
        nullable: true,
        default: null,
    },

    subtotal: {
        name: 'subtotal',
        type: 'numeric',
        precision: 14,
        scale: 2,
        nullable: false,
        default: 0,
    },

    items_discount_total: {
        name: 'items_discount_total',
        type: 'numeric',
        precision: 14,
        scale: 2,
        nullable: false,
        default: 0,
    },

    global_discount_type: {
        name: 'global_discount_type',
        type: 'varchar',
        length: 20,
        nullable: false,
        default: 'value',
        allowedValues: [
            'value',
            'percent',
        ],
    },

    global_discount_value: {
        name: 'global_discount_value',
        type: 'numeric',
        precision: 14,
        scale: 2,
        nullable: false,
        default: 0,
    },

    global_discount_amount: {
        name: 'global_discount_amount',
        type: 'numeric',
        precision: 14,
        scale: 2,
        nullable: false,
        default: 0,
    },

    total_discount: {
        name: 'total_discount',
        type: 'numeric',
        precision: 14,
        scale: 2,
        nullable: false,
        default: 0,
    },

    total_amount: {
        name: 'total_amount',
        type: 'numeric',
        precision: 14,
        scale: 2,
        nullable: false,
        default: 0,
    },

    notes: {
        name: 'notes',
        type: 'text',
        nullable: true,
        default: null,
    },

    created_at: {
        name: 'created_at',
        type: 'timestamptz',
        nullable: false,
        generated: true,
        default: 'now()',
    },

    updated_at: {
        name: 'updated_at',
        type: 'timestamptz',
        nullable: false,
        generated: true,
        default: 'now()',
    },
});


// ──────────────────────────────────────────────────────────────────────
// 3. ALL COLUMN NAMES
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_COLUMN_NAMES = Object.freeze(
    Object.keys(BUDGETS_COLUMNS)
);


// ──────────────────────────────────────────────────────────────────────
// 4. SELECT COLUMNS
//
// Explicit list is useful to avoid SELECT * and guarantees that the API
// returns only columns officially defined by this catalog.
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_SELECT_COLUMNS = Object.freeze([
    'budget_id',
    'issue_date',
    'status',

    'customer_id',
    'customer_name',
    'customer_tax_id',
    'customer_email',
    'customer_phone',

    'seller_id',
    'price_id',
    'operation_type_id',
    'payment_form_id',
    'payment_term_id',
    'budget_shipping_id',

    'subtotal',
    'items_discount_total',

    'global_discount_type',
    'global_discount_value',
    'global_discount_amount',

    'total_discount',
    'total_amount',

    'notes',

    'created_at',
    'updated_at',
]);


// ──────────────────────────────────────────────────────────────────────
// 5. INSERTABLE COLUMNS
//
// Excluded:
//
// budget_id
//   PostgreSQL identity.
//
// created_at
//   PostgreSQL now().
//
// updated_at
//   PostgreSQL now() and trigger.
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_INSERT_COLUMNS = Object.freeze([
    'issue_date',
    'status',

    'customer_id',
    'customer_name',
    'customer_tax_id',
    'customer_email',
    'customer_phone',

    'seller_id',
    'price_id',
    'operation_type_id',
    'payment_form_id',
    'payment_term_id',
    'budget_shipping_id',

    'subtotal',
    'items_discount_total',

    'global_discount_type',
    'global_discount_value',
    'global_discount_amount',

    'total_discount',
    'total_amount',

    'notes',
]);


// ──────────────────────────────────────────────────────────────────────
// 6. UPDATABLE COLUMNS
//
// Excluded:
//
// budget_id
// created_at
// updated_at
//
// updated_at is controlled by trg_budgets_updated_at.
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_UPDATE_COLUMNS = Object.freeze([
    'issue_date',
    'status',

    'customer_id',
    'customer_name',
    'customer_tax_id',
    'customer_email',
    'customer_phone',

    'seller_id',
    'price_id',
    'operation_type_id',
    'payment_form_id',
    'payment_term_id',
    'budget_shipping_id',

    'subtotal',
    'items_discount_total',

    'global_discount_type',
    'global_discount_value',
    'global_discount_amount',

    'total_discount',
    'total_amount',

    'notes',
]);


// ──────────────────────────────────────────────────────────────────────
// 7. NOT NULL DATABASE COLUMNS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NOT_NULL_COLUMNS = Object.freeze([
    'budget_id',
    'issue_date',
    'status',
    'customer_name',
    'customer_tax_id',

    'subtotal',
    'items_discount_total',

    'global_discount_type',
    'global_discount_value',
    'global_discount_amount',

    'total_discount',
    'total_amount',

    'created_at',
    'updated_at',
]);


// ──────────────────────────────────────────────────────────────────────
// 8. API REQUIRED COLUMNS
//
// Fields that must normally be supplied by the application.
//
// Other NOT NULL fields have PostgreSQL defaults.
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_API_REQUIRED_COLUMNS = Object.freeze([
    'customer_name',
    'customer_tax_id',
]);


// ──────────────────────────────────────────────────────────────────────
// 9. DATABASE DEFAULTS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_DEFAULTS = Object.freeze({
    issue_date: 'CURRENT_DATE',

    status: 'ABERTO',

    subtotal: 0,

    items_discount_total: 0,

    global_discount_type: 'value',

    global_discount_value: 0,

    global_discount_amount: 0,

    total_discount: 0,

    total_amount: 0,
});


// ──────────────────────────────────────────────────────────────────────
// 10. ENUM-LIKE VALUES
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_GLOBAL_DISCOUNT_TYPES = Object.freeze([
    'value',
    'percent',
]);


// ──────────────────────────────────────────────────────────────────────
// 11. CHECK CONSTRAINTS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_CHECK_CONSTRAINTS = Object.freeze({

    ck_budgets_customer_name: {
        columns: ['customer_name'],
        rule: 'NOT_EMPTY',
        sql: `btrim(customer_name::text) <> ''::text`,
    },

    ck_budgets_customer_tax_id: {
        columns: ['customer_tax_id'],
        rule: 'NOT_EMPTY',
        sql: `btrim(customer_tax_id::text) <> ''::text`,
    },

    ck_budgets_status: {
        columns: ['status'],
        rule: 'NOT_EMPTY',
        sql: `btrim(status::text) <> ''::text`,
    },

    ck_budgets_discount_type: {
        columns: ['global_discount_type'],
        rule: 'IN',
        values: BUDGETS_GLOBAL_DISCOUNT_TYPES,
    },

    ck_budgets_values: {
        columns: [
            'subtotal',
            'items_discount_total',
            'global_discount_value',
            'global_discount_amount',
            'total_discount',
            'total_amount',
        ],

        rule: 'GREATER_THAN_OR_EQUAL_TO_ZERO',
    },
});


// ──────────────────────────────────────────────────────────────────────
// 12. FOREIGN KEYS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_FOREIGN_KEYS = Object.freeze({

    operation_type_id: {
        constraint: 'fk_budgets_operation_type',

        column: 'operation_type_id',

        references: {
            schema: 'public',
            table: 'nfeOperationTypes',
            column: 'operation_type_id',
        },

        onUpdate: 'CASCADE',

        onDelete: 'RESTRICT',
    },


    price_id: {
        constraint: 'fk_budgets_price',

        column: 'price_id',

        references: {
            schema: 'public',
            table: 'prices',
            column: 'price_id',
        },

        onUpdate: 'CASCADE',

        onDelete: 'RESTRICT',
    },


    budget_shipping_id: {
        constraint: 'fk_budgets_shipping',

        column: 'budget_shipping_id',

        references: {
            schema: 'public',
            table: 'budgetsShipping',
            column: 'budget_shipping_id',
        },

        onUpdate: 'CASCADE',

        onDelete: 'SET NULL',
    },
});


// ──────────────────────────────────────────────────────────────────────
// 13. INDEXES
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_INDEXES = Object.freeze({

    budgets_pkey: {
        columns: ['budget_id'],

        primaryKey: true,

        unique: true,
    },


    idx_budgets_customer_email: {
        expression: 'lower(customer_email)',

        where: 'customer_email IS NOT NULL',
    },


    idx_budgets_customer_id: {
        columns: ['customer_id'],

        where: 'customer_id IS NOT NULL',
    },


    idx_budgets_customer_name: {
        expression: 'lower(customer_name)',
    },


    idx_budgets_customer_tax: {
        columns: ['customer_tax_id'],
    },


    idx_budgets_customer_tax_id: {
        columns: ['customer_tax_id'],
    },


    idx_budgets_issue_date: {
        columns: ['issue_date'],
    },


    idx_budgets_operation_type_id: {
        columns: ['operation_type_id'],

        where: 'operation_type_id IS NOT NULL',
    },


    idx_budgets_payment_form_id: {
        columns: ['payment_form_id'],

        where: 'payment_form_id IS NOT NULL',
    },


    idx_budgets_payment_term_id: {
        columns: ['payment_term_id'],

        where: 'payment_term_id IS NOT NULL',
    },


    idx_budgets_price_id: {
        columns: ['price_id'],

        where: 'price_id IS NOT NULL',
    },


    idx_budgets_seller_id: {
        columns: ['seller_id'],

        where: 'seller_id IS NOT NULL',
    },


    idx_budgets_status: {
        columns: ['status'],
    },


    uq_budgets_shipping: {
        columns: ['budget_shipping_id'],

        unique: true,

        where: 'budget_shipping_id IS NOT NULL',
    },
});


// ──────────────────────────────────────────────────────────────────────
// 14. REFERENCED-BY TABLES
// ──────────────────────────────────────────────────────────────────────
//
// NOTE:
//
// budgetItens is kept here because it currently appears in PostgreSQL's
// \d budgets output.
//
// It should be removed from this catalog after the legacy table and its
// foreign key are removed from the database.
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_REFERENCED_BY = Object.freeze([

    {
        schema: 'public',

        table: 'budgetItens',

        foreignKey: 'budget_id',

        references: 'budget_id',

        constraint: 'budgetItens_budget_id_fkey',

        onUpdate: null,

        onDelete: 'CASCADE',
    },


    {
        schema: 'public',

        table: 'budgetsNfeAttempts',

        foreignKey: 'budget_id',

        references: 'budget_id',

        constraint: 'fk_budget_nfe_attempt_budget',

        onUpdate: 'CASCADE',

        onDelete: 'RESTRICT',
    },


    {
        schema: 'public',

        table: 'budgetsItems',

        foreignKey: 'budget_id',

        references: 'budget_id',

        constraint: 'fk_budgets_items_budget',

        onUpdate: 'CASCADE',

        onDelete: 'CASCADE',
    },
]);


// ──────────────────────────────────────────────────────────────────────
// 15. TRIGGERS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_TRIGGERS = Object.freeze({

    trg_budgets_updated_at: {
        timing: 'BEFORE',

        event: 'UPDATE',

        scope: 'FOR EACH ROW',

        function: 'set_updated_at_budgets()',
    },
});


// ──────────────────────────────────────────────────────────────────────
// 16. COLUMN GROUPS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_CUSTOMER_COLUMNS = Object.freeze([
    'customer_id',
    'customer_name',
    'customer_tax_id',
    'customer_email',
    'customer_phone',
]);


export const BUDGETS_PAYMENT_COLUMNS = Object.freeze([
    'payment_form_id',
    'payment_term_id',
]);


export const BUDGETS_COMMERCIAL_COLUMNS = Object.freeze([
    'seller_id',
    'price_id',
    'operation_type_id',
]);


export const BUDGETS_TOTAL_COLUMNS = Object.freeze([
    'subtotal',

    'items_discount_total',

    'global_discount_type',

    'global_discount_value',

    'global_discount_amount',

    'total_discount',

    'total_amount',
]);


// ──────────────────────────────────────────────────────────────────────
// 17. SQL SELECT COLUMN LIST
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_SELECT_SQL = BUDGETS_SELECT_COLUMNS
    .map((column) => `b."${column}"`)
    .join(',\n');


// ──────────────────────────────────────────────────────────────────────
// 18. BASIC HELPERS
// ──────────────────────────────────────────────────────────────────────

export function isBudgetColumn(column) {
    return Object.prototype.hasOwnProperty.call(
        BUDGETS_COLUMNS,
        String(column || '')
    );
}


export function isBudgetInsertColumn(column) {
    return BUDGETS_INSERT_COLUMNS.includes(
        String(column || '')
    );
}


export function isBudgetUpdateColumn(column) {
    return BUDGETS_UPDATE_COLUMNS.includes(
        String(column || '')
    );
}


export function getBudgetColumnDefinition(column) {
    return BUDGETS_COLUMNS[
        String(column || '')
    ] || null;
}


// ──────────────────────────────────────────────────────────────────────
// 19. OBJECT HELPERS
// ──────────────────────────────────────────────────────────────────────

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


// ──────────────────────────────────────────────────────────────────────
// 20. INSERT PAYLOAD SANITIZER
// ──────────────────────────────────────────────────────────────────────

export function pickBudgetInsertPayload(payload = {}) {

    if (!isPlainObject(payload)) {
        return {};
    }

    const output = {};

    for (const column of BUDGETS_INSERT_COLUMNS) {

        if (!hasOwn(payload, column)) {
            continue;
        }

        output[column] = payload[column];
    }

    return output;
}


// ──────────────────────────────────────────────────────────────────────
// 21. UPDATE PAYLOAD SANITIZER
// ──────────────────────────────────────────────────────────────────────

export function pickBudgetUpdatePayload(payload = {}) {

    if (!isPlainObject(payload)) {
        return {};
    }

    const output = {};

    for (const column of BUDGETS_UPDATE_COLUMNS) {

        if (!hasOwn(payload, column)) {
            continue;
        }

        output[column] = payload[column];
    }

    return output;
}


// ──────────────────────────────────────────────────────────────────────
// 22. REQUIRED FIELDS VALIDATOR
// ──────────────────────────────────────────────────────────────────────

export function validateBudgetRequiredFields(payload = {}) {

    const errors = [];

    if (!isPlainObject(payload)) {
        return {
            valid: false,

            errors: [
                {
                    field: null,
                    message: 'Payload de orçamento inválido.',
                },
            ],
        };
    }


    for (const column of BUDGETS_API_REQUIRED_COLUMNS) {

        const value = payload[column];

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

                message: `Campo obrigatório: ${column}.`,
            });
        }
    }


    return {
        valid: errors.length === 0,

        errors,
    };
}


// ──────────────────────────────────────────────────────────────────────
// 23. DISCOUNT TYPE VALIDATION
// ──────────────────────────────────────────────────────────────────────

export function isValidBudgetDiscountType(value) {

    return BUDGETS_GLOBAL_DISCOUNT_TYPES.includes(
        String(value || '').trim().toLowerCase()
    );
}


// ──────────────────────────────────────────────────────────────────────
// 24. NON-NEGATIVE VALUE VALIDATION
// ──────────────────────────────────────────────────────────────────────

export function validateBudgetNumericValues(payload = {}) {

    const errors = [];


    const numericColumns = [
        'subtotal',

        'items_discount_total',

        'global_discount_value',

        'global_discount_amount',

        'total_discount',

        'total_amount',
    ];


    for (const column of numericColumns) {

        if (!hasOwn(payload, column)) {
            continue;
        }


        const rawValue = payload[column];


        if (
            rawValue === null ||
            rawValue === undefined ||
            rawValue === ''
        ) {
            continue;
        }


        const value = Number(rawValue);


        if (!Number.isFinite(value)) {

            errors.push({
                field: column,

                message:
                    `O campo ${column} precisa ser um número válido.`,
            });

            continue;
        }


        if (value < 0) {

            errors.push({
                field: column,

                message:
                    `O campo ${column} não pode ser negativo.`,
            });
        }
    }


    return {
        valid: errors.length === 0,

        errors,
    };
}


// ──────────────────────────────────────────────────────────────────────
// 25. COMPLETE PAYLOAD VALIDATION
// ──────────────────────────────────────────────────────────────────────

export function validateBudgetPayload(
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
                        'Payload de orçamento inválido.',
                },
            ],
        };
    }


    if (requireRequiredFields) {

        const requiredValidation =
            validateBudgetRequiredFields(payload);

        errors.push(
            ...requiredValidation.errors
        );
    }


    if (
        hasOwn(payload, 'global_discount_type') &&
        !isValidBudgetDiscountType(
            payload.global_discount_type
        )
    ) {

        errors.push({
            field: 'global_discount_type',

            message:
                'global_discount_type deve ser "value" ou "percent".',
        });
    }


    const numericValidation =
        validateBudgetNumericValues(payload);

    errors.push(
        ...numericValidation.errors
    );


    return {
        valid: errors.length === 0,

        errors,
    };
}


// ──────────────────────────────────────────────────────────────────────
// 26. BUILD SAFE INSERT DATA
// ──────────────────────────────────────────────────────────────────────

export function prepareBudgetInsert(payload = {}) {

    const data = pickBudgetInsertPayload(payload);


    const validation = validateBudgetPayload(
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


// ──────────────────────────────────────────────────────────────────────
// 27. BUILD SAFE UPDATE DATA
// ──────────────────────────────────────────────────────────────────────

export function prepareBudgetUpdate(payload = {}) {

    const data = pickBudgetUpdatePayload(payload);


    const validation = validateBudgetPayload(
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


// ──────────────────────────────────────────────────────────────────────
// 28. DEFAULT EXPORT
// ──────────────────────────────────────────────────────────────────────

const budgetsSchema = Object.freeze({

    schema: BUDGETS_SCHEMA_NAME,

    table: BUDGETS_TABLE_NAME,

    qualifiedTable: BUDGETS_TABLE,

    primaryKey: BUDGETS_PRIMARY_KEY,


    columns: BUDGETS_COLUMNS,

    columnNames: BUDGETS_COLUMN_NAMES,

    selectColumns: BUDGETS_SELECT_COLUMNS,

    selectSql: BUDGETS_SELECT_SQL,

    insertColumns: BUDGETS_INSERT_COLUMNS,

    updateColumns: BUDGETS_UPDATE_COLUMNS,

    notNullColumns: BUDGETS_NOT_NULL_COLUMNS,

    apiRequiredColumns:
        BUDGETS_API_REQUIRED_COLUMNS,


    defaults: BUDGETS_DEFAULTS,


    allowedValues: {
        globalDiscountTypes:
            BUDGETS_GLOBAL_DISCOUNT_TYPES,
    },


    checks:
        BUDGETS_CHECK_CONSTRAINTS,

    foreignKeys:
        BUDGETS_FOREIGN_KEYS,

    indexes:
        BUDGETS_INDEXES,

    referencedBy:
        BUDGETS_REFERENCED_BY,

    triggers:
        BUDGETS_TRIGGERS,


    groups: {

        customer:
            BUDGETS_CUSTOMER_COLUMNS,

        payment:
            BUDGETS_PAYMENT_COLUMNS,

        commercial:
            BUDGETS_COMMERCIAL_COLUMNS,

        totals:
            BUDGETS_TOTAL_COLUMNS,
    },


    helpers: {

        isColumn:
            isBudgetColumn,

        isInsertColumn:
            isBudgetInsertColumn,

        isUpdateColumn:
            isBudgetUpdateColumn,

        getColumnDefinition:
            getBudgetColumnDefinition,

        pickInsertPayload:
            pickBudgetInsertPayload,

        pickUpdatePayload:
            pickBudgetUpdatePayload,

        validateRequiredFields:
            validateBudgetRequiredFields,

        validateNumericValues:
            validateBudgetNumericValues,

        validatePayload:
            validateBudgetPayload,

        prepareInsert:
            prepareBudgetInsert,

        prepareUpdate:
            prepareBudgetUpdate,
    },
});


export default budgetsSchema;
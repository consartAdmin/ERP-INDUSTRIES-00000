// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.productsFiscalV2.js — PostgreSQL schema catalog       ║
// ║ CONSART ERP | Table: public."productsFiscalV2"                         ║
// ║                                                                      ║
// ║ Purpose                                                              ║
// ║ - Centralize the real structure of public."productsFiscalV2"           ║
// ║ - Avoid duplicated column names across APIs                          ║
// ║ - Provide metadata for validation, SELECT, INSERT and UPDATE         ║
// ║ - Keep the fiscal APIs synchronized with the PostgreSQL schema       ║
// ║                                                                      ║
// ║ Versioning rule                                                      ║
// ║ - Only ONE row per product_code may be current AND active            ║
// ║   (unique index products_fiscal_v2_current_product_ux)               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

// ──────────────────────────────────────────────────────────────────────
// 1. TABLE IDENTIFICATION
// ──────────────────────────────────────────────────────────────────────

export const PRODUCTS_FISCAL_V2_SCHEMA_NAME = 'public';

export const PRODUCTS_FISCAL_V2_TABLE_NAME = 'productsFiscalV2';

export const PRODUCTS_FISCAL_V2_TABLE = `${PRODUCTS_FISCAL_V2_SCHEMA_NAME}."${PRODUCTS_FISCAL_V2_TABLE_NAME}"`;

export const PRODUCTS_FISCAL_V2_PRIMARY_KEY = 'products_fiscal_id';


// ──────────────────────────────────────────────────────────────────────
// 2. COLUMN DEFINITIONS
// ──────────────────────────────────────────────────────────────────────

export const PRODUCTS_FISCAL_V2_COLUMNS = Object.freeze({

    products_fiscal_id: {
        name: 'products_fiscal_id',
        type: 'bigint',
        nullable: false,
        primaryKey: true,
        identity: true,
        generated: true,
        default: null,
    },

    product_code: {
        name: 'product_code',
        type: 'varchar',
        length: 60,
        nullable: false,
        default: null,
    },

    fiscal_classification_id: {
        name: 'fiscal_classification_id',
        type: 'integer',
        nullable: false,
        default: null,
    },

    effective_from: {
        name: 'effective_from',
        type: 'timestamptz',
        nullable: false,
        default: 'now()',
    },

    effective_to: {
        name: 'effective_to',
        type: 'timestamptz',
        nullable: true,
        default: null,
    },

    version: {
        name: 'version',
        type: 'integer',
        nullable: false,
        default: 1,
    },

    is_current: {
        name: 'is_current',
        type: 'boolean',
        nullable: false,
        default: true,
    },

    is_active: {
        name: 'is_active',
        type: 'boolean',
        nullable: false,
        default: true,
    },

    source_system: {
        name: 'source_system',
        type: 'varchar',
        length: 60,
        nullable: true,
        default: null,
    },

    source_reference: {
        name: 'source_reference',
        type: 'varchar',
        length: 120,
        nullable: true,
        default: null,
    },

    extra_payload: {
        name: 'extra_payload',
        type: 'jsonb',
        nullable: false,
        default: `'{}'::jsonb`,
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

export const PRODUCTS_FISCAL_V2_COLUMN_NAMES = Object.freeze(
    Object.keys(PRODUCTS_FISCAL_V2_COLUMNS)
);


// ──────────────────────────────────────────────────────────────────────
// 4. SELECT COLUMNS
//
// Explicit list is useful to avoid SELECT * and guarantees that the API
// returns only columns officially defined by this catalog.
// ──────────────────────────────────────────────────────────────────────

export const PRODUCTS_FISCAL_V2_SELECT_COLUMNS = Object.freeze([
    'products_fiscal_id',

    'product_code',
    'fiscal_classification_id',

    'effective_from',
    'effective_to',
    'version',
    'is_current',
    'is_active',

    'source_system',
    'source_reference',
    'extra_payload',

    'created_at',
    'updated_at',
]);


// ──────────────────────────────────────────────────────────────────────
// 5. INSERTABLE COLUMNS
//
// Excluded:
//
// products_fiscal_id
//   PostgreSQL identity (GENERATED ALWAYS).
//
// created_at
//   PostgreSQL now().
//
// updated_at
//   PostgreSQL now() and trigger.
//
// NOTE:
//
// Before inserting a new current version of a product, the previous
// current row of the same product_code must be closed
// (is_current = false, effective_to = now()). Otherwise the insert
// violates products_fiscal_v2_current_product_ux.
// ──────────────────────────────────────────────────────────────────────

export const PRODUCTS_FISCAL_V2_INSERT_COLUMNS = Object.freeze([
    'product_code',
    'fiscal_classification_id',

    'effective_from',
    'effective_to',
    'version',
    'is_current',
    'is_active',

    'source_system',
    'source_reference',
    'extra_payload',
]);


// ──────────────────────────────────────────────────────────────────────
// 6. UPDATABLE COLUMNS
//
// Excluded:
//
// products_fiscal_id
// product_code
// created_at
// updated_at
//
// product_code is excluded because a fiscal version belongs to a single
// product. To move a product to another fiscal setup, close the current
// version and insert a new row.
//
// updated_at is controlled by products_fiscal_v2_updated_at.
// ──────────────────────────────────────────────────────────────────────

export const PRODUCTS_FISCAL_V2_UPDATE_COLUMNS = Object.freeze([
    'fiscal_classification_id',

    'effective_from',
    'effective_to',
    'version',
    'is_current',
    'is_active',

    'source_system',
    'source_reference',
    'extra_payload',
]);


// ──────────────────────────────────────────────────────────────────────
// 7. NOT NULL DATABASE COLUMNS
// ──────────────────────────────────────────────────────────────────────

export const PRODUCTS_FISCAL_V2_NOT_NULL_COLUMNS = Object.freeze([
    'products_fiscal_id',
    'product_code',
    'fiscal_classification_id',

    'effective_from',
    'version',
    'is_current',
    'is_active',

    'extra_payload',

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

export const PRODUCTS_FISCAL_V2_API_REQUIRED_COLUMNS = Object.freeze([
    'product_code',
    'fiscal_classification_id',
]);


// ──────────────────────────────────────────────────────────────────────
// 9. DATABASE DEFAULTS
// ──────────────────────────────────────────────────────────────────────

export const PRODUCTS_FISCAL_V2_DEFAULTS = Object.freeze({
    effective_from: 'now()',

    version: 1,

    is_current: true,

    is_active: true,

    extra_payload: `'{}'::jsonb`,
});


// ──────────────────────────────────────────────────────────────────────
// 10. CHECK CONSTRAINTS
// ──────────────────────────────────────────────────────────────────────

export const PRODUCTS_FISCAL_V2_CHECK_CONSTRAINTS = Object.freeze({

    products_fiscal_v2_dates_chk: {
        columns: ['effective_from', 'effective_to'],
        rule: 'DATE_RANGE',
        sql: `effective_to IS NULL OR effective_to >= effective_from`,
    },

    products_fiscal_v2_extra_payload_chk: {
        columns: ['extra_payload'],
        rule: 'JSON_OBJECT',
        sql: `jsonb_typeof(extra_payload) = 'object'::text`,
    },

    products_fiscal_v2_version_chk: {
        columns: ['version'],
        rule: 'GREATER_THAN_ZERO',
        sql: `version > 0`,
    },
});


// ──────────────────────────────────────────────────────────────────────
// 11. FOREIGN KEYS
// ──────────────────────────────────────────────────────────────────────
//
// NOTE:
//
// product_code has NO foreign key to public.products(product_code).
// Its length is also different: varchar(60) here, varchar(50) in
// public.products.
// ──────────────────────────────────────────────────────────────────────

export const PRODUCTS_FISCAL_V2_FOREIGN_KEYS = Object.freeze({

    fiscal_classification_id: {
        constraint: 'products_fiscal_v2_classification_fk',

        column: 'fiscal_classification_id',

        references: {
            schema: 'public',
            table: 'fiscalClassificationV2',
            column: 'fiscal_classification_id',
        },

        onUpdate: 'CASCADE',

        onDelete: 'RESTRICT',
    },
});


// ──────────────────────────────────────────────────────────────────────
// 12. INDEXES
// ──────────────────────────────────────────────────────────────────────

export const PRODUCTS_FISCAL_V2_INDEXES = Object.freeze({

    products_fiscal_v2_pk: {
        columns: ['products_fiscal_id'],

        primaryKey: true,

        unique: true,
    },


    products_fiscal_v2_classification_idx: {
        columns: ['fiscal_classification_id'],
    },


    products_fiscal_v2_current_product_ux: {
        columns: ['product_code'],

        unique: true,

        where: 'is_current = true AND is_active = true',
    },


    products_fiscal_v2_product_idx: {
        columns: ['product_code'],
    },
});


// ──────────────────────────────────────────────────────────────────────
// 13. REFERENCED-BY TABLES
// ──────────────────────────────────────────────────────────────────────

export const PRODUCTS_FISCAL_V2_REFERENCED_BY = Object.freeze([

    {
        schema: 'public',

        table: 'budgetsNfeAttemptItems',

        foreignKey: 'products_fiscal_id',

        references: 'products_fiscal_id',

        constraint: 'fk_budgetsNfeAttemptItems_product_fiscal',

        onUpdate: 'CASCADE',

        onDelete: 'SET NULL',
    },


    {
        schema: 'public',

        table: 'ordersNfeAttemptItems',

        foreignKey: 'products_fiscal_id',

        references: 'products_fiscal_id',

        constraint: 'fk_ordersNfeAttemptItems_product_fiscal',

        onUpdate: 'CASCADE',

        onDelete: 'SET NULL',
    },
]);


// ──────────────────────────────────────────────────────────────────────
// 14. TRIGGERS
// ──────────────────────────────────────────────────────────────────────

export const PRODUCTS_FISCAL_V2_TRIGGERS = Object.freeze({

    products_fiscal_v2_updated_at: {
        timing: 'BEFORE',

        event: 'UPDATE',

        scope: 'FOR EACH ROW',

        function: 'set_timestamp()',
    },
});


// ──────────────────────────────────────────────────────────────────────
// 15. COLUMN GROUPS
// ──────────────────────────────────────────────────────────────────────

export const PRODUCTS_FISCAL_V2_LINK_COLUMNS = Object.freeze([
    'product_code',
    'fiscal_classification_id',
]);


export const PRODUCTS_FISCAL_V2_VALIDITY_COLUMNS = Object.freeze([
    'effective_from',
    'effective_to',
    'version',
    'is_current',
    'is_active',
]);


export const PRODUCTS_FISCAL_V2_SOURCE_COLUMNS = Object.freeze([
    'source_system',
    'source_reference',
    'extra_payload',
]);


// ──────────────────────────────────────────────────────────────────────
// 16. SQL SELECT COLUMN LIST
// ──────────────────────────────────────────────────────────────────────

export const PRODUCTS_FISCAL_V2_SELECT_SQL = PRODUCTS_FISCAL_V2_SELECT_COLUMNS
    .map((column) => `pf."${column}"`)
    .join(',\n');


// Filter for the single current + active fiscal row of a product.
// Matches the predicate of products_fiscal_v2_current_product_ux.
export const PRODUCTS_FISCAL_V2_CURRENT_WHERE_SQL =
    'pf."is_current" = true AND pf."is_active" = true';


// ──────────────────────────────────────────────────────────────────────
// 17. BASIC HELPERS
// ──────────────────────────────────────────────────────────────────────

export function isProductFiscalColumn(column) {
    return Object.prototype.hasOwnProperty.call(
        PRODUCTS_FISCAL_V2_COLUMNS,
        String(column || '')
    );
}


export function isProductFiscalInsertColumn(column) {
    return PRODUCTS_FISCAL_V2_INSERT_COLUMNS.includes(
        String(column || '')
    );
}


export function isProductFiscalUpdateColumn(column) {
    return PRODUCTS_FISCAL_V2_UPDATE_COLUMNS.includes(
        String(column || '')
    );
}


export function getProductFiscalColumnDefinition(column) {
    return PRODUCTS_FISCAL_V2_COLUMNS[
        String(column || '')
    ] || null;
}


// ──────────────────────────────────────────────────────────────────────
// 18. OBJECT AND VALUE HELPERS
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


function isBlankValue(value) {
    return (
        value === null ||
        (
            typeof value === 'string' &&
            value.trim() === ''
        )
    );
}


// Accepts a plain object or a JSON string that parses to one.
function isJsonObjectValue(value) {

    if (isPlainObject(value)) {
        return true;
    }

    if (typeof value !== 'string') {
        return false;
    }

    try {
        return isPlainObject(JSON.parse(value));
    } catch {
        return false;
    }
}


function toTimestamp(value) {

    if (value instanceof Date) {
        return value.getTime();
    }

    if (
        typeof value === 'string' ||
        typeof value === 'number'
    ) {
        return new Date(value).getTime();
    }

    return Number.NaN;
}


// ──────────────────────────────────────────────────────────────────────
// 19. INSERT PAYLOAD SANITIZER
// ──────────────────────────────────────────────────────────────────────

export function pickProductFiscalInsertPayload(payload = {}) {

    if (!isPlainObject(payload)) {
        return {};
    }

    const output = {};

    for (const column of PRODUCTS_FISCAL_V2_INSERT_COLUMNS) {

        if (!hasOwn(payload, column)) {
            continue;
        }

        output[column] = payload[column];
    }

    return output;
}


// ──────────────────────────────────────────────────────────────────────
// 20. UPDATE PAYLOAD SANITIZER
// ──────────────────────────────────────────────────────────────────────

export function pickProductFiscalUpdatePayload(payload = {}) {

    if (!isPlainObject(payload)) {
        return {};
    }

    const output = {};

    for (const column of PRODUCTS_FISCAL_V2_UPDATE_COLUMNS) {

        if (!hasOwn(payload, column)) {
            continue;
        }

        output[column] = payload[column];
    }

    return output;
}


// ──────────────────────────────────────────────────────────────────────
// 21. REQUIRED FIELDS VALIDATOR
// ──────────────────────────────────────────────────────────────────────

export function validateProductFiscalRequiredFields(payload = {}) {

    const errors = [];

    if (!isPlainObject(payload)) {
        return {
            valid: false,

            errors: [
                {
                    field: null,
                    message: 'Payload de dados fiscais do produto inválido.',
                },
            ],
        };
    }


    for (const column of PRODUCTS_FISCAL_V2_API_REQUIRED_COLUMNS) {

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
// 22. VERSION VALIDATION
//
// Mirrors products_fiscal_v2_version_chk (version > 0).
// ──────────────────────────────────────────────────────────────────────

export function validateProductFiscalVersion(payload = {}) {

    const errors = [];


    if (
        !isPlainObject(payload) ||
        !hasOwn(payload, 'version') ||
        payload.version === undefined
    ) {
        return {
            valid: true,

            errors,
        };
    }


    const rawValue = payload.version;


    if (isBlankValue(rawValue)) {

        errors.push({
            field: 'version',

            message:
                'O campo version não pode ser nulo.',
        });

    } else {

        const value = Number(rawValue);


        if (
            !Number.isInteger(value) ||
            value <= 0
        ) {

            errors.push({
                field: 'version',

                message:
                    'O campo version precisa ser um número inteiro maior que zero.',
            });
        }
    }


    return {
        valid: errors.length === 0,

        errors,
    };
}


// ──────────────────────────────────────────────────────────────────────
// 23. EFFECTIVE DATE RANGE VALIDATION
//
// Mirrors products_fiscal_v2_dates_chk
// (effective_to IS NULL OR effective_to >= effective_from).
//
// On UPDATE, when only one of the two dates is sent, the range can only
// be checked by PostgreSQL against the value already stored.
// ──────────────────────────────────────────────────────────────────────

export function validateProductFiscalDates(payload = {}) {

    const errors = [];

    const timestamps = {};


    if (!isPlainObject(payload)) {
        return {
            valid: true,

            errors,
        };
    }


    for (const column of ['effective_from', 'effective_to']) {

        if (
            !hasOwn(payload, column) ||
            payload[column] === undefined
        ) {
            continue;
        }


        const rawValue = payload[column];


        if (isBlankValue(rawValue)) {

            if (!PRODUCTS_FISCAL_V2_COLUMNS[column].nullable) {

                errors.push({
                    field: column,

                    message:
                        `O campo ${column} não pode ser nulo.`,
                });
            }

            continue;
        }


        const time = toTimestamp(rawValue);


        if (Number.isNaN(time)) {

            errors.push({
                field: column,

                message:
                    `O campo ${column} precisa ser uma data válida.`,
            });

            continue;
        }


        timestamps[column] = time;
    }


    if (
        timestamps.effective_from !== undefined &&
        timestamps.effective_to !== undefined &&
        timestamps.effective_to < timestamps.effective_from
    ) {

        errors.push({
            field: 'effective_to',

            message:
                'effective_to não pode ser anterior a effective_from.',
        });
    }


    return {
        valid: errors.length === 0,

        errors,
    };
}


// ──────────────────────────────────────────────────────────────────────
// 24. EXTRA PAYLOAD VALIDATION
//
// Mirrors products_fiscal_v2_extra_payload_chk
// (jsonb_typeof(extra_payload) = 'object').
// ──────────────────────────────────────────────────────────────────────

export function validateProductFiscalExtraPayload(payload = {}) {

    const errors = [];


    if (
        !isPlainObject(payload) ||
        !hasOwn(payload, 'extra_payload') ||
        payload.extra_payload === undefined
    ) {
        return {
            valid: true,

            errors,
        };
    }


    const value = payload.extra_payload;


    if (value === null) {

        errors.push({
            field: 'extra_payload',

            message:
                'O campo extra_payload não pode ser nulo.',
        });

    } else if (!isJsonObjectValue(value)) {

        errors.push({
            field: 'extra_payload',

            message:
                'O campo extra_payload deve ser um objeto JSON.',
        });
    }


    return {
        valid: errors.length === 0,

        errors,
    };
}


// ──────────────────────────────────────────────────────────────────────
// 25. COMPLETE PAYLOAD VALIDATION
// ──────────────────────────────────────────────────────────────────────

export function validateProductFiscalPayload(
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
                        'Payload de dados fiscais do produto inválido.',
                },
            ],
        };
    }


    if (requireRequiredFields) {

        const requiredValidation =
            validateProductFiscalRequiredFields(payload);

        errors.push(
            ...requiredValidation.errors
        );
    }


    const versionValidation =
        validateProductFiscalVersion(payload);

    errors.push(
        ...versionValidation.errors
    );


    const datesValidation =
        validateProductFiscalDates(payload);

    errors.push(
        ...datesValidation.errors
    );


    const extraPayloadValidation =
        validateProductFiscalExtraPayload(payload);

    errors.push(
        ...extraPayloadValidation.errors
    );


    return {
        valid: errors.length === 0,

        errors,
    };
}


// ──────────────────────────────────────────────────────────────────────
// 26. BUILD SAFE INSERT DATA
// ──────────────────────────────────────────────────────────────────────

export function prepareProductFiscalInsert(payload = {}) {

    const data = pickProductFiscalInsertPayload(payload);


    const validation = validateProductFiscalPayload(
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

export function prepareProductFiscalUpdate(payload = {}) {

    const data = pickProductFiscalUpdatePayload(payload);


    const validation = validateProductFiscalPayload(
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

const productsFiscalV2Schema = Object.freeze({

    schema: PRODUCTS_FISCAL_V2_SCHEMA_NAME,

    table: PRODUCTS_FISCAL_V2_TABLE_NAME,

    qualifiedTable: PRODUCTS_FISCAL_V2_TABLE,

    primaryKey: PRODUCTS_FISCAL_V2_PRIMARY_KEY,


    columns: PRODUCTS_FISCAL_V2_COLUMNS,

    columnNames: PRODUCTS_FISCAL_V2_COLUMN_NAMES,

    selectColumns: PRODUCTS_FISCAL_V2_SELECT_COLUMNS,

    selectSql: PRODUCTS_FISCAL_V2_SELECT_SQL,

    currentWhereSql: PRODUCTS_FISCAL_V2_CURRENT_WHERE_SQL,

    insertColumns: PRODUCTS_FISCAL_V2_INSERT_COLUMNS,

    updateColumns: PRODUCTS_FISCAL_V2_UPDATE_COLUMNS,

    notNullColumns: PRODUCTS_FISCAL_V2_NOT_NULL_COLUMNS,

    apiRequiredColumns:
        PRODUCTS_FISCAL_V2_API_REQUIRED_COLUMNS,


    defaults: PRODUCTS_FISCAL_V2_DEFAULTS,


    checks:
        PRODUCTS_FISCAL_V2_CHECK_CONSTRAINTS,

    foreignKeys:
        PRODUCTS_FISCAL_V2_FOREIGN_KEYS,

    indexes:
        PRODUCTS_FISCAL_V2_INDEXES,

    referencedBy:
        PRODUCTS_FISCAL_V2_REFERENCED_BY,

    triggers:
        PRODUCTS_FISCAL_V2_TRIGGERS,


    groups: {

        link:
            PRODUCTS_FISCAL_V2_LINK_COLUMNS,

        validity:
            PRODUCTS_FISCAL_V2_VALIDITY_COLUMNS,

        source:
            PRODUCTS_FISCAL_V2_SOURCE_COLUMNS,
    },


    helpers: {

        isColumn:
            isProductFiscalColumn,

        isInsertColumn:
            isProductFiscalInsertColumn,

        isUpdateColumn:
            isProductFiscalUpdateColumn,

        getColumnDefinition:
            getProductFiscalColumnDefinition,

        pickInsertPayload:
            pickProductFiscalInsertPayload,

        pickUpdatePayload:
            pickProductFiscalUpdatePayload,

        validateRequiredFields:
            validateProductFiscalRequiredFields,

        validateVersion:
            validateProductFiscalVersion,

        validateDates:
            validateProductFiscalDates,

        validateExtraPayload:
            validateProductFiscalExtraPayload,

        validatePayload:
            validateProductFiscalPayload,

        prepareInsert:
            prepareProductFiscalInsert,

        prepareUpdate:
            prepareProductFiscalUpdate,
    },
});


export default productsFiscalV2Schema;

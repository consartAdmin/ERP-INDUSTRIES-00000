// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.fiscalProfileV2.js — PostgreSQL schema catalog        ║
// ║ CONSART ERP | Table: public.fiscalProfileV2                          ║
// ║                                                                      ║
// ║ Purpose                                                              ║
// ║ - Centralize the real structure of public.fiscalProfileV2            ║
// ║ - Avoid duplicated column names across APIs                          ║
// ║ - Provide metadata for validation, SELECT, INSERT and UPDATE         ║
// ║ - Keep the fiscal APIs synchronized with the PostgreSQL schema       ║
// ║                                                                      ║
// ║ Content                                                              ║
// ║ - ICMS / ICMS ST                                                     ║
// ║ - PIS / COFINS                                                       ║
// ║ - IPI                                                                ║
// ║ - CFOP                                                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

// ──────────────────────────────────────────────────────────────────────
// 1. TABLE IDENTIFICATION
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_SCHEMA_NAME = 'public';

export const FISCAL_PROFILE_V2_TABLE_NAME = 'fiscalProfileV2';

export const FISCAL_PROFILE_V2_TABLE = `${FISCAL_PROFILE_V2_SCHEMA_NAME}."${FISCAL_PROFILE_V2_TABLE_NAME}"`;

export const FISCAL_PROFILE_V2_PRIMARY_KEY = 'fiscal_profile_id';


// ──────────────────────────────────────────────────────────────────────
// 2. COLUMN DEFINITIONS
//
// Kept in the physical order of the database. icms_base_pct through
// ipi_rate come after updated_at because they were added later.
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_COLUMNS = Object.freeze({

    fiscal_profile_id: {
        name: 'fiscal_profile_id',
        type: 'integer',
        nullable: false,
        primaryKey: true,
        identity: true,
        generated: true,
        default: null,
    },

    profile_name: {
        name: 'profile_name',
        type: 'varchar',
        length: 100,
        nullable: false,
        default: null,
    },

    description: {
        name: 'description',
        type: 'text',
        nullable: true,
        default: null,
    },

    icms_cst: {
        name: 'icms_cst',
        type: 'varchar',
        length: 3,
        nullable: true,
        default: null,
    },

    icms_rate: {
        name: 'icms_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },

    origin_code: {
        name: 'origin_code',
        type: 'varchar',
        length: 2,
        nullable: true,
        default: null,
    },

    cfop_entry: {
        name: 'cfop_entry',
        type: 'varchar',
        length: 10,
        nullable: true,
        default: null,
    },

    cfop_exit: {
        name: 'cfop_exit',
        type: 'varchar',
        length: 10,
        nullable: true,
        default: null,
    },

    pis_cst: {
        name: 'pis_cst',
        type: 'varchar',
        length: 3,
        nullable: true,
        default: null,
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
        default: null,
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
        default: null,
    },

    is_active: {
        name: 'is_active',
        type: 'boolean',
        nullable: false,
        default: true,
    },

    created_at: {
        name: 'created_at',
        type: 'timestamp',
        nullable: false,
        generated: true,
        default: 'now()',
    },

    updated_at: {
        name: 'updated_at',
        type: 'timestamp',
        nullable: false,
        generated: true,
        default: 'now()',
    },

    icms_base_pct: {
        name: 'icms_base_pct',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 100,
    },

    mva_pct: {
        name: 'mva_pct',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: true,
        default: null,
    },

    icms_st_base_pct: {
        name: 'icms_st_base_pct',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: true,
        default: null,
    },

    icms_st_rate: {
        name: 'icms_st_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: true,
        default: null,
    },

    icms_st_ret_base_pct: {
        name: 'icms_st_ret_base_pct',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: true,
        default: null,
    },

    icms_st_ret_rate: {
        name: 'icms_st_ret_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: true,
        default: null,
    },

    ipi_rate: {
        name: 'ipi_rate',
        type: 'numeric',
        precision: 9,
        scale: 4,
        nullable: false,
        default: 0,
    },
});


// ──────────────────────────────────────────────────────────────────────
// 3. ALL COLUMN NAMES
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_COLUMN_NAMES = Object.freeze(
    Object.keys(FISCAL_PROFILE_V2_COLUMNS)
);


// ──────────────────────────────────────────────────────────────────────
// 4. SELECT COLUMNS
//
// Explicit list is useful to avoid SELECT * and guarantees that the API
// returns only columns officially defined by this catalog.
//
// Grouped by tax (not in physical order) for readability.
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_SELECT_COLUMNS = Object.freeze([
    'fiscal_profile_id',
    'profile_name',
    'description',

    'icms_cst',
    'origin_code',
    'icms_rate',
    'icms_base_pct',
    'benefit_code',

    'mva_pct',
    'icms_st_base_pct',
    'icms_st_rate',
    'icms_st_ret_base_pct',
    'icms_st_ret_rate',

    'pis_cst',
    'pis_rate',
    'cofins_cst',
    'cofins_rate',

    'ipi_rate',

    'cfop_entry',
    'cfop_exit',

    'is_active',

    'created_at',
    'updated_at',
]);


// ──────────────────────────────────────────────────────────────────────
// 5. INSERTABLE COLUMNS
//
// Excluded:
//
// fiscal_profile_id
//   PostgreSQL identity (GENERATED ALWAYS).
//
// created_at
//   PostgreSQL now().
//
// updated_at
//   PostgreSQL now() and trigger.
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_INSERT_COLUMNS = Object.freeze([
    'profile_name',
    'description',

    'icms_cst',
    'origin_code',
    'icms_rate',
    'icms_base_pct',
    'benefit_code',

    'mva_pct',
    'icms_st_base_pct',
    'icms_st_rate',
    'icms_st_ret_base_pct',
    'icms_st_ret_rate',

    'pis_cst',
    'pis_rate',
    'cofins_cst',
    'cofins_rate',

    'ipi_rate',

    'cfop_entry',
    'cfop_exit',

    'is_active',
]);


// ──────────────────────────────────────────────────────────────────────
// 6. UPDATABLE COLUMNS
//
// Excluded:
//
// fiscal_profile_id
// created_at
// updated_at
//
// updated_at is controlled by fiscal_profile_v2_updated_at.
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_UPDATE_COLUMNS = Object.freeze([
    'profile_name',
    'description',

    'icms_cst',
    'origin_code',
    'icms_rate',
    'icms_base_pct',
    'benefit_code',

    'mva_pct',
    'icms_st_base_pct',
    'icms_st_rate',
    'icms_st_ret_base_pct',
    'icms_st_ret_rate',

    'pis_cst',
    'pis_rate',
    'cofins_cst',
    'cofins_rate',

    'ipi_rate',

    'cfop_entry',
    'cfop_exit',

    'is_active',
]);


// ──────────────────────────────────────────────────────────────────────
// 7. NOT NULL DATABASE COLUMNS
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_NOT_NULL_COLUMNS = Object.freeze([
    'fiscal_profile_id',
    'profile_name',

    'icms_rate',
    'icms_base_pct',
    'pis_rate',
    'cofins_rate',
    'ipi_rate',

    'is_active',

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

export const FISCAL_PROFILE_V2_API_REQUIRED_COLUMNS = Object.freeze([
    'profile_name',
]);


// ──────────────────────────────────────────────────────────────────────
// 9. DATABASE DEFAULTS
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_DEFAULTS = Object.freeze({
    icms_rate: 0,

    icms_base_pct: 100,

    pis_rate: 0,

    cofins_rate: 0,

    ipi_rate: 0,

    is_active: true,
});


// ──────────────────────────────────────────────────────────────────────
// 10. NUMERIC RANGES
//
// max: null means there is no upper limit (MVA can be above 100 %).
// Whether NULL is accepted comes from the column definition.
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_NUMERIC_RANGES = Object.freeze({

    icms_rate: { min: 0, max: 100 },

    icms_base_pct: { min: 0, max: 100 },

    pis_rate: { min: 0, max: 100 },

    cofins_rate: { min: 0, max: 100 },

    ipi_rate: { min: 0, max: 100 },

    mva_pct: { min: 0, max: null },

    icms_st_base_pct: { min: 0, max: 100 },

    icms_st_rate: { min: 0, max: 100 },

    icms_st_ret_base_pct: { min: 0, max: 100 },

    icms_st_ret_rate: { min: 0, max: 100 },
});


// ──────────────────────────────────────────────────────────────────────
// 11. CHECK CONSTRAINTS
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_CHECK_CONSTRAINTS = Object.freeze({

    fiscal_profile_v2_icms_rate_chk: {
        columns: ['icms_rate'],
        rule: 'BETWEEN_0_AND_100',
        sql: `icms_rate >= 0::numeric AND icms_rate <= 100::numeric`,
    },

    fiscal_profile_v2_icms_base_pct_chk: {
        columns: ['icms_base_pct'],
        rule: 'BETWEEN_0_AND_100',
        sql: `icms_base_pct >= 0::numeric AND icms_base_pct <= 100::numeric`,
    },

    fiscal_profile_v2_pis_rate_chk: {
        columns: ['pis_rate'],
        rule: 'BETWEEN_0_AND_100',
        sql: `pis_rate >= 0::numeric AND pis_rate <= 100::numeric`,
    },

    fiscal_profile_v2_cofins_rate_chk: {
        columns: ['cofins_rate'],
        rule: 'BETWEEN_0_AND_100',
        sql: `cofins_rate >= 0::numeric AND cofins_rate <= 100::numeric`,
    },

    fiscal_profile_v2_ipi_rate_chk: {
        columns: ['ipi_rate'],
        rule: 'BETWEEN_0_AND_100',
        sql: `ipi_rate >= 0::numeric AND ipi_rate <= 100::numeric`,
    },

    fiscal_profile_v2_mva_pct_chk: {
        columns: ['mva_pct'],
        rule: 'NULL_OR_GREATER_THAN_OR_EQUAL_TO_ZERO',
        sql: `mva_pct IS NULL OR mva_pct >= 0::numeric`,
    },

    fiscal_profile_v2_icms_st_base_pct_chk: {
        columns: ['icms_st_base_pct'],
        rule: 'NULL_OR_BETWEEN_0_AND_100',
        sql: `icms_st_base_pct IS NULL OR icms_st_base_pct >= 0::numeric AND icms_st_base_pct <= 100::numeric`,
    },

    fiscal_profile_v2_icms_st_rate_chk: {
        columns: ['icms_st_rate'],
        rule: 'NULL_OR_BETWEEN_0_AND_100',
        sql: `icms_st_rate IS NULL OR icms_st_rate >= 0::numeric AND icms_st_rate <= 100::numeric`,
    },

    fiscal_profile_v2_icms_st_ret_base_pct_chk: {
        columns: ['icms_st_ret_base_pct'],
        rule: 'NULL_OR_BETWEEN_0_AND_100',
        sql: `icms_st_ret_base_pct IS NULL OR icms_st_ret_base_pct >= 0::numeric AND icms_st_ret_base_pct <= 100::numeric`,
    },

    fiscal_profile_v2_icms_st_ret_rate_chk: {
        columns: ['icms_st_ret_rate'],
        rule: 'NULL_OR_BETWEEN_0_AND_100',
        sql: `icms_st_ret_rate IS NULL OR icms_st_ret_rate >= 0::numeric AND icms_st_ret_rate <= 100::numeric`,
    },
});


// ──────────────────────────────────────────────────────────────────────
// 12. FOREIGN KEYS
//
// fiscalProfileV2 has no foreign keys of its own.
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_FOREIGN_KEYS = Object.freeze({});


// ──────────────────────────────────────────────────────────────────────
// 13. INDEXES
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_INDEXES = Object.freeze({

    fiscal_profile_v2_pk: {
        columns: ['fiscal_profile_id'],

        primaryKey: true,

        unique: true,
    },


    fiscal_profile_v2_active_idx: {
        columns: ['is_active'],
    },


    fiscal_profile_v2_cfop_entry_idx: {
        columns: ['cfop_entry'],
    },


    fiscal_profile_v2_cfop_exit_idx: {
        columns: ['cfop_exit'],
    },


    fiscal_profile_v2_icms_idx: {
        columns: ['icms_cst', 'origin_code'],
    },


    fiscal_profile_v2_name_unique: {
        expression: 'lower(profile_name)',

        unique: true,
    },
});


// ──────────────────────────────────────────────────────────────────────
// 14. REFERENCED-BY TABLES
// ──────────────────────────────────────────────────────────────────────
//
// NOTE:
//
// Every reference uses ON DELETE SET NULL: deleting a profile silently
// removes the link from classifications and NF-e attempt items.
// Prefer is_active = false.
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_REFERENCED_BY = Object.freeze([

    {
        schema: 'public',

        table: 'fiscalClassificationV2',

        foreignKey: 'fiscal_profile_id',

        references: 'fiscal_profile_id',

        constraint: 'fiscal_classification_v2_profile_fk',

        onUpdate: 'CASCADE',

        onDelete: 'SET NULL',
    },


    {
        schema: 'public',

        table: 'budgetsNfeAttemptItems',

        foreignKey: 'fiscal_profile_id',

        references: 'fiscal_profile_id',

        constraint: 'fk_budgetsNfeAttemptItems_profile',

        onUpdate: 'CASCADE',

        onDelete: 'SET NULL',
    },


    {
        schema: 'public',

        table: 'ordersNfeAttemptItems',

        foreignKey: 'fiscal_profile_id',

        references: 'fiscal_profile_id',

        constraint: 'fk_ordersNfeAttemptItems_profile',

        onUpdate: 'CASCADE',

        onDelete: 'SET NULL',
    },


    {
        schema: 'public',

        table: 'productFiscalCostRules',

        foreignKey: 'fiscal_profile_id',

        references: 'fiscal_profile_id',

        constraint: 'productFiscalCostRules_profile_fk',

        onUpdate: 'CASCADE',

        onDelete: 'SET NULL',
    },
]);


// ──────────────────────────────────────────────────────────────────────
// 15. TRIGGERS
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_TRIGGERS = Object.freeze({

    fiscal_profile_v2_updated_at: {
        timing: 'BEFORE',

        event: 'UPDATE',

        scope: 'FOR EACH ROW',

        function: 'set_timestamp()',
    },
});


// ──────────────────────────────────────────────────────────────────────
// 16. COLUMN GROUPS
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_ICMS_COLUMNS = Object.freeze([
    'icms_cst',
    'origin_code',
    'icms_rate',
    'icms_base_pct',
    'benefit_code',
]);


export const FISCAL_PROFILE_V2_ICMS_ST_COLUMNS = Object.freeze([
    'mva_pct',
    'icms_st_base_pct',
    'icms_st_rate',
    'icms_st_ret_base_pct',
    'icms_st_ret_rate',
]);


export const FISCAL_PROFILE_V2_PIS_COFINS_COLUMNS = Object.freeze([
    'pis_cst',
    'pis_rate',
    'cofins_cst',
    'cofins_rate',
]);


export const FISCAL_PROFILE_V2_IPI_COLUMNS = Object.freeze([
    'ipi_rate',
]);


export const FISCAL_PROFILE_V2_CFOP_COLUMNS = Object.freeze([
    'cfop_entry',
    'cfop_exit',
]);


// ──────────────────────────────────────────────────────────────────────
// 17. SQL SELECT COLUMN LIST
// ──────────────────────────────────────────────────────────────────────

export const FISCAL_PROFILE_V2_SELECT_SQL = FISCAL_PROFILE_V2_SELECT_COLUMNS
    .map((column) => `fp."${column}"`)
    .join(',\n');


// ──────────────────────────────────────────────────────────────────────
// 18. BASIC HELPERS
// ──────────────────────────────────────────────────────────────────────

export function isFiscalProfileColumn(column) {
    return Object.prototype.hasOwnProperty.call(
        FISCAL_PROFILE_V2_COLUMNS,
        String(column || '')
    );
}


export function isFiscalProfileInsertColumn(column) {
    return FISCAL_PROFILE_V2_INSERT_COLUMNS.includes(
        String(column || '')
    );
}


export function isFiscalProfileUpdateColumn(column) {
    return FISCAL_PROFILE_V2_UPDATE_COLUMNS.includes(
        String(column || '')
    );
}


export function getFiscalProfileColumnDefinition(column) {
    return FISCAL_PROFILE_V2_COLUMNS[
        String(column || '')
    ] || null;
}


// ──────────────────────────────────────────────────────────────────────
// 19. OBJECT AND VALUE HELPERS
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


// ──────────────────────────────────────────────────────────────────────
// 20. INSERT PAYLOAD SANITIZER
// ──────────────────────────────────────────────────────────────────────

export function pickFiscalProfileInsertPayload(payload = {}) {

    if (!isPlainObject(payload)) {
        return {};
    }

    const output = {};

    for (const column of FISCAL_PROFILE_V2_INSERT_COLUMNS) {

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

export function pickFiscalProfileUpdatePayload(payload = {}) {

    if (!isPlainObject(payload)) {
        return {};
    }

    const output = {};

    for (const column of FISCAL_PROFILE_V2_UPDATE_COLUMNS) {

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

export function validateFiscalProfileRequiredFields(payload = {}) {

    const errors = [];

    if (!isPlainObject(payload)) {
        return {
            valid: false,

            errors: [
                {
                    field: null,
                    message: 'Payload de perfil fiscal inválido.',
                },
            ],
        };
    }


    for (const column of FISCAL_PROFILE_V2_API_REQUIRED_COLUMNS) {

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
// 23. NUMERIC VALUE VALIDATION
//
// Mirrors every check constraint of the table (all of them are numeric
// ranges). NOT NULL rates cannot be sent as null or empty; nullable
// ICMS ST values can.
// ──────────────────────────────────────────────────────────────────────

export function validateFiscalProfileNumericValues(payload = {}) {

    const errors = [];


    if (!isPlainObject(payload)) {
        return {
            valid: true,

            errors,
        };
    }


    for (const [column, range] of Object.entries(FISCAL_PROFILE_V2_NUMERIC_RANGES)) {

        if (
            !hasOwn(payload, column) ||
            payload[column] === undefined
        ) {
            continue;
        }


        const rawValue = payload[column];


        if (isBlankValue(rawValue)) {

            if (!FISCAL_PROFILE_V2_COLUMNS[column].nullable) {

                errors.push({
                    field: column,

                    message:
                        `O campo ${column} não pode ser nulo.`,
                });
            }

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


        if (range.max === null) {

            if (value < range.min) {

                errors.push({
                    field: column,

                    message:
                        `O campo ${column} não pode ser negativo.`,
                });
            }

            continue;
        }


        if (
            value < range.min ||
            value > range.max
        ) {

            errors.push({
                field: column,

                message:
                    `O campo ${column} deve estar entre ${range.min} e ${range.max}.`,
            });
        }
    }


    return {
        valid: errors.length === 0,

        errors,
    };
}


// ──────────────────────────────────────────────────────────────────────
// 24. COMPLETE PAYLOAD VALIDATION
//
// NOTE:
//
// The case-insensitive uniqueness of profile_name
// (fiscal_profile_v2_name_unique) can only be enforced by PostgreSQL.
// ──────────────────────────────────────────────────────────────────────

export function validateFiscalProfilePayload(
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
                        'Payload de perfil fiscal inválido.',
                },
            ],
        };
    }


    if (requireRequiredFields) {

        const requiredValidation =
            validateFiscalProfileRequiredFields(payload);

        errors.push(
            ...requiredValidation.errors
        );
    }


    const numericValidation =
        validateFiscalProfileNumericValues(payload);

    errors.push(
        ...numericValidation.errors
    );


    return {
        valid: errors.length === 0,

        errors,
    };
}


// ──────────────────────────────────────────────────────────────────────
// 25. BUILD SAFE INSERT DATA
// ──────────────────────────────────────────────────────────────────────

export function prepareFiscalProfileInsert(payload = {}) {

    const data = pickFiscalProfileInsertPayload(payload);


    const validation = validateFiscalProfilePayload(
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
// 26. BUILD SAFE UPDATE DATA
// ──────────────────────────────────────────────────────────────────────

export function prepareFiscalProfileUpdate(payload = {}) {

    const data = pickFiscalProfileUpdatePayload(payload);


    const validation = validateFiscalProfilePayload(
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
// 27. DEFAULT EXPORT
// ──────────────────────────────────────────────────────────────────────

const fiscalProfileV2Schema = Object.freeze({

    schema: FISCAL_PROFILE_V2_SCHEMA_NAME,

    table: FISCAL_PROFILE_V2_TABLE_NAME,

    qualifiedTable: FISCAL_PROFILE_V2_TABLE,

    primaryKey: FISCAL_PROFILE_V2_PRIMARY_KEY,


    columns: FISCAL_PROFILE_V2_COLUMNS,

    columnNames: FISCAL_PROFILE_V2_COLUMN_NAMES,

    selectColumns: FISCAL_PROFILE_V2_SELECT_COLUMNS,

    selectSql: FISCAL_PROFILE_V2_SELECT_SQL,

    insertColumns: FISCAL_PROFILE_V2_INSERT_COLUMNS,

    updateColumns: FISCAL_PROFILE_V2_UPDATE_COLUMNS,

    notNullColumns: FISCAL_PROFILE_V2_NOT_NULL_COLUMNS,

    apiRequiredColumns:
        FISCAL_PROFILE_V2_API_REQUIRED_COLUMNS,


    defaults: FISCAL_PROFILE_V2_DEFAULTS,


    numericRanges:
        FISCAL_PROFILE_V2_NUMERIC_RANGES,


    checks:
        FISCAL_PROFILE_V2_CHECK_CONSTRAINTS,

    foreignKeys:
        FISCAL_PROFILE_V2_FOREIGN_KEYS,

    indexes:
        FISCAL_PROFILE_V2_INDEXES,

    referencedBy:
        FISCAL_PROFILE_V2_REFERENCED_BY,

    triggers:
        FISCAL_PROFILE_V2_TRIGGERS,


    groups: {

        icms:
            FISCAL_PROFILE_V2_ICMS_COLUMNS,

        icmsSt:
            FISCAL_PROFILE_V2_ICMS_ST_COLUMNS,

        pisCofins:
            FISCAL_PROFILE_V2_PIS_COFINS_COLUMNS,

        ipi:
            FISCAL_PROFILE_V2_IPI_COLUMNS,

        cfop:
            FISCAL_PROFILE_V2_CFOP_COLUMNS,
    },


    helpers: {

        isColumn:
            isFiscalProfileColumn,

        isInsertColumn:
            isFiscalProfileInsertColumn,

        isUpdateColumn:
            isFiscalProfileUpdateColumn,

        getColumnDefinition:
            getFiscalProfileColumnDefinition,

        pickInsertPayload:
            pickFiscalProfileInsertPayload,

        pickUpdatePayload:
            pickFiscalProfileUpdatePayload,

        validateRequiredFields:
            validateFiscalProfileRequiredFields,

        validateNumericValues:
            validateFiscalProfileNumericValues,

        validatePayload:
            validateFiscalProfilePayload,

        prepareInsert:
            prepareFiscalProfileInsert,

        prepareUpdate:
            prepareFiscalProfileUpdate,
    },
});


export default fiscalProfileV2Schema;


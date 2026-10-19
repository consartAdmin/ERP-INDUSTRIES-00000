// ============================================================================
// catalog_schema_appFeatures.js
// CONSART ERP | PostgreSQL | Node.js ES modules
// Declarative catalog for public."appFeatures".
//
// This module does not connect to the database, run migrations, create triggers,
// normalize payloads, or resolve feature values. Constraints and relationships
// below describe the supplied table; database enforcement stays in PostgreSQL.
// ============================================================================

'use strict';

/** Recursively freeze the plain metadata objects and arrays declared here. */
function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(deepFreeze);
        Object.freeze(value);
    }
    return value;
}

// SQL identifiers are fixed constants, never values supplied by a request.
export const APP_FEATURES_SCHEMA_NAME = 'public';
export const APP_FEATURES_TABLE_NAME = 'appFeatures';
export const APP_FEATURES_TABLE = 'public."appFeatures"';
export const APP_FEATURES_PRIMARY_KEY = 'feature_id';

export const APP_FEATURES_VALUE_TYPES = Object.freeze([
    'BOOLEAN',
    'OPTION',
    'NUMBER',
    'TEXT',
    'JSON',
]);

// Literal defaults only. Timestamp expressions are recorded in columns below.
// Repositories must apply these defaults or omit missing columns on INSERT.
// Merely importing this object does not apply defaults to a payload.
export const APP_FEATURES_DEFAULTS = Object.freeze({
    value_type: 'OPTION',
    is_active: true,
});

/**
 * Column metadata in database order.
 * defaultSql === null means no explicit SQL default was supplied.
 * Identity generation is represented separately from an SQL DEFAULT.
 * No bigint-to-Number conversion is performed by this catalog.
 */
export const APP_FEATURES_COLUMNS = deepFreeze({
    feature_id: {
        type: 'bigint',
        nullable: false,
        primaryKey: true,
        identity: 'BY DEFAULT',
        defaultSql: null,
    },
    feature_code: {
        type: 'character varying(100)',
        maxLength: 100,
        nullable: false,
        defaultSql: null,
    },
    feature_name: {
        type: 'character varying(150)',
        maxLength: 150,
        nullable: false,
        defaultSql: null,
    },
    description: {
        type: 'text',
        nullable: true,
        defaultSql: null,
    },
    value_type: {
        type: 'character varying(20)',
        maxLength: 20,
        nullable: false,
        defaultSql: "'OPTION'::character varying",
        allowedValues: APP_FEATURES_VALUE_TYPES,
    },
    default_value: {
        type: 'jsonb',
        nullable: true,
        defaultSql: null,
    },
    is_active: {
        type: 'boolean',
        nullable: false,
        defaultSql: 'true',
    },
    created_at: {
        type: 'timestamp with time zone',
        nullable: false,
        defaultSql: 'now()',
    },
    updated_at: {
        type: 'timestamp with time zone',
        nullable: false,
        defaultSql: 'now()',
    },
});

export const APP_FEATURES_SELECT_COLUMNS = Object.freeze(
    Object.keys(APP_FEATURES_COLUMNS),
);

/**
 * Normal application write lists, not extra database restrictions.
 * Identity and timestamps are intentionally excluded from ordinary writes.
 * BY DEFAULT identity still permits explicit IDs in dedicated import workflows.
 */
export const APP_FEATURES_INSERT_COLUMNS = Object.freeze([
    'feature_code',
    'feature_name',
    'description',
    'value_type',
    'default_value',
    'is_active',
]);

export const APP_FEATURES_UPDATE_COLUMNS = Object.freeze([
    ...APP_FEATURES_INSERT_COLUMNS,
]);

// Required input when creating a row without an explicit identity/timestamps.
// Other NOT NULL columns have identity generation or database defaults.
export const APP_FEATURES_REQUIRED_FIELDS = Object.freeze([
    'feature_code',
    'feature_name',
]);

// Application search/order conventions; these are not database constraints.
export const APP_FEATURES_SEARCH_FIELDS = Object.freeze([
    'feature_code',
    'feature_name',
    'description',
]);

export const APP_FEATURES_DEFAULT_ORDER = 'feature_code ASC, feature_id ASC';

export const APP_FEATURES_CONSTRAINTS = deepFreeze({
    primaryKey: {
        name: 'appFeatures_pkey',
        columns: [APP_FEATURES_PRIMARY_KEY],
    },
    unique: [
        {
            name: 'uq_appFeatures_code',
            columns: ['feature_code'],
        },
    ],
    checks: [
        {
            name: 'ck_appFeatures_code',
            expression: 'feature_code::text = upper(feature_code::text)',
        },
        {
            name: 'ck_appFeatures_value_type',
            expression:
                "value_type::text = ANY (ARRAY['BOOLEAN', 'OPTION', 'NUMBER', 'TEXT', 'JSON']::text[])",
        },
    ],
    // No outgoing foreign keys were listed for appFeatures.
    foreignKeys: [],
});

// Both indexes below back constraints; they are not additional indexes to create.
export const APP_FEATURES_INDEXES = deepFreeze([
    {
        name: 'appFeatures_pkey',
        method: 'btree',
        unique: true,
        primary: true,
        columns: [APP_FEATURES_PRIMARY_KEY],
        constraintName: 'appFeatures_pkey',
    },
    {
        name: 'uq_appFeatures_code',
        method: 'btree',
        unique: true,
        primary: false,
        columns: ['feature_code'],
        constraintName: 'uq_appFeatures_code',
    },
]);

// Incoming references: these foreign keys belong to the CHILD tables.
export const APP_FEATURES_REFERENCED_BY = deepFreeze([
    {
        name: 'fk_appFeatureAssignments_feature',
        table: 'public."appFeatureAssignments"',
        columns: ['feature_id'],
        references: {
            table: APP_FEATURES_TABLE,
            columns: [APP_FEATURES_PRIMARY_KEY],
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
    },
    {
        name: 'fk_appFeatureOptions_feature',
        table: 'public."appFeatureOptions"',
        columns: ['feature_id'],
        references: {
            table: APP_FEATURES_TABLE,
            columns: [APP_FEATURES_PRIMARY_KEY],
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
    },
]);

// The trigger function body/schema was not supplied; neither is invented here.
export const APP_FEATURES_TRIGGERS = deepFreeze([
    {
        name: 'trg_appFeatures_updatedAt',
        table: APP_FEATURES_TABLE,
        timing: 'BEFORE',
        events: ['UPDATE'],
        forEach: 'ROW',
        functionName: 'setAppFeatureUpdatedAt',
        functionCall: '"setAppFeatureUpdatedAt"()',
    },
]);

/**
 * Default descriptor for repository/API consumers.
 * fields contains writable business columns; selectFields contains all columns.
 * Metadata is descriptive: consumers remain responsible for parameterized SQL,
 * payload validation, JSON serialization, defaults, and partial-update handling.
 */
export const APP_FEATURES_SCHEMA = deepFreeze({
    schemaName: APP_FEATURES_SCHEMA_NAME,
    tableName: APP_FEATURES_TABLE_NAME,
    table: APP_FEATURES_TABLE,
    idField: APP_FEATURES_PRIMARY_KEY,
    primaryKey: APP_FEATURES_PRIMARY_KEY,
    fields: APP_FEATURES_INSERT_COLUMNS,
    selectFields: APP_FEATURES_SELECT_COLUMNS,
    insertFields: APP_FEATURES_INSERT_COLUMNS,
    updateFields: APP_FEATURES_UPDATE_COLUMNS,
    requiredFields: APP_FEATURES_REQUIRED_FIELDS,
    searchFields: APP_FEATURES_SEARCH_FIELDS,
    defaultOrder: APP_FEATURES_DEFAULT_ORDER,
    columns: APP_FEATURES_COLUMNS,
    defaults: APP_FEATURES_DEFAULTS,
    valueTypes: APP_FEATURES_VALUE_TYPES,
    constraints: APP_FEATURES_CONSTRAINTS,
    indexes: APP_FEATURES_INDEXES,
    referencedBy: APP_FEATURES_REFERENCED_BY,
    triggers: APP_FEATURES_TRIGGERS,
});

export {
    APP_FEATURES_SCHEMA as catalog_schema,
    APP_FEATURES_SCHEMA as catalog_schema_appFeatures,
};

export default APP_FEATURES_SCHEMA;

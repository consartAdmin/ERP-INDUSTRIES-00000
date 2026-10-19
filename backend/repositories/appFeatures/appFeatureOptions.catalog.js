// ============================================================================
// catalog_schema_appFeatureOptions.js
// CONSART ERP | PostgreSQL | Node.js ES modules
// Declarative catalog for public."appFeatureOptions".
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
export const APP_FEATURE_OPTIONS_SCHEMA_NAME = 'public';
export const APP_FEATURE_OPTIONS_TABLE_NAME = 'appFeatureOptions';
export const APP_FEATURE_OPTIONS_TABLE = 'public."appFeatureOptions"';
export const APP_FEATURE_OPTIONS_PRIMARY_KEY = 'feature_option_id';

// Literal defaults only. Timestamp expressions are recorded in columns below.
// Repositories must apply these defaults or omit missing columns on INSERT.
// Merely importing this object does not apply defaults to a payload.
// option_config is immutable metadata; clone it before adding configuration.
export const APP_FEATURE_OPTIONS_DEFAULTS = deepFreeze({
    option_config: {},
    sort_order: 0,
    is_active: true,
});

/**
 * Column metadata in database order.
 * defaultSql === null means no explicit SQL default was supplied.
 * Identity generation is represented separately from an SQL DEFAULT.
 * No bigint-to-Number conversion is performed by this catalog.
 */
export const APP_FEATURE_OPTIONS_COLUMNS = deepFreeze({
    feature_option_id: {
        type: 'bigint',
        nullable: false,
        primaryKey: true,
        identity: 'BY DEFAULT',
        defaultSql: null,
    },
    feature_id: {
        type: 'bigint',
        nullable: false,
        defaultSql: null,
    },
    option_code: {
        type: 'character varying(100)',
        maxLength: 100,
        nullable: false,
        defaultSql: null,
    },
    option_name: {
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
    option_config: {
        type: 'jsonb',
        nullable: false,
        defaultSql: "'{}'::jsonb",
    },
    sort_order: {
        type: 'integer',
        nullable: false,
        defaultSql: '0',
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

export const APP_FEATURE_OPTIONS_SELECT_COLUMNS = Object.freeze(
    Object.keys(APP_FEATURE_OPTIONS_COLUMNS),
);

/**
 * Normal application write lists, not extra database restrictions.
 * Identity and timestamps are intentionally excluded from ordinary writes.
 * BY DEFAULT identity still permits explicit IDs in dedicated import workflows.
 * feature_id is writable; PostgreSQL enforces the declared relationships.
 */
export const APP_FEATURE_OPTIONS_INSERT_COLUMNS = Object.freeze([
    'feature_id',
    'option_code',
    'option_name',
    'description',
    'option_config',
    'sort_order',
    'is_active',
]);

export const APP_FEATURE_OPTIONS_UPDATE_COLUMNS = Object.freeze([
    ...APP_FEATURE_OPTIONS_INSERT_COLUMNS,
]);

// Required input when creating a row without an explicit identity/timestamps.
// Other NOT NULL columns have identity generation or database defaults.
export const APP_FEATURE_OPTIONS_REQUIRED_FIELDS = Object.freeze([
    'feature_id',
    'option_code',
    'option_name',
]);

// Application search/order conventions; these are not database constraints.
export const APP_FEATURE_OPTIONS_SEARCH_FIELDS = Object.freeze([
    'option_code',
    'option_name',
    'description',
]);

export const APP_FEATURE_OPTIONS_DEFAULT_ORDER =
    'feature_id ASC, sort_order ASC, option_code ASC, feature_option_id ASC';

export const APP_FEATURE_OPTIONS_CONSTRAINTS = deepFreeze({
    primaryKey: {
        name: 'appFeatureOptions_pkey',
        columns: [APP_FEATURE_OPTIONS_PRIMARY_KEY],
    },
    unique: [
        {
            name: 'uq_appFeatureOptions_code',
            columns: ['feature_id', 'option_code'],
        },
        {
            name: 'uq_appFeatureOptions_feature_option',
            columns: ['feature_id', 'feature_option_id'],
        },
    ],
    checks: [
        {
            name: 'ck_appFeatureOptions_code',
            expression: 'option_code::text = upper(option_code::text)',
        },
    ],
    // Outgoing foreign key: this constraint belongs to appFeatureOptions.
    foreignKeys: [
        {
            name: 'fk_appFeatureOptions_feature',
            columns: ['feature_id'],
            references: {
                table: 'public."appFeatures"',
                columns: ['feature_id'],
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
    ],
});

// constraintName identifies indexes backing PRIMARY KEY / UNIQUE constraints.
// idx_appFeatureOptions_active is a separate, non-unique index.
export const APP_FEATURE_OPTIONS_INDEXES = deepFreeze([
    {
        name: 'appFeatureOptions_pkey',
        method: 'btree',
        unique: true,
        primary: true,
        columns: [APP_FEATURE_OPTIONS_PRIMARY_KEY],
        constraintName: 'appFeatureOptions_pkey',
    },
    {
        name: 'idx_appFeatureOptions_active',
        method: 'btree',
        unique: false,
        primary: false,
        columns: ['feature_id', 'is_active', 'sort_order'],
        constraintName: null,
    },
    {
        name: 'uq_appFeatureOptions_code',
        method: 'btree',
        unique: true,
        primary: false,
        columns: ['feature_id', 'option_code'],
        constraintName: 'uq_appFeatureOptions_code',
    },
    {
        name: 'uq_appFeatureOptions_feature_option',
        method: 'btree',
        unique: true,
        primary: false,
        columns: ['feature_id', 'feature_option_id'],
        constraintName: 'uq_appFeatureOptions_feature_option',
    },
]);

// Incoming references: these foreign keys belong to the CHILD tables.
// Preserve both columns and RESTRICT; this is not a feature_option_id-only FK.
export const APP_FEATURE_OPTIONS_REFERENCED_BY = deepFreeze([
    {
        name: 'fk_appFeatureAssignments_option',
        table: 'public."appFeatureAssignments"',
        columns: ['feature_id', 'feature_option_id'],
        references: {
            table: APP_FEATURE_OPTIONS_TABLE,
            columns: ['feature_id', 'feature_option_id'],
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
    },
]);

// The trigger function body/schema was not supplied; neither is invented here.
export const APP_FEATURE_OPTIONS_TRIGGERS = deepFreeze([
    {
        name: 'trg_appFeatureOptions_updatedAt',
        table: APP_FEATURE_OPTIONS_TABLE,
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
export const APP_FEATURE_OPTIONS_SCHEMA = deepFreeze({
    schemaName: APP_FEATURE_OPTIONS_SCHEMA_NAME,
    tableName: APP_FEATURE_OPTIONS_TABLE_NAME,
    table: APP_FEATURE_OPTIONS_TABLE,
    idField: APP_FEATURE_OPTIONS_PRIMARY_KEY,
    primaryKey: APP_FEATURE_OPTIONS_PRIMARY_KEY,
    fields: APP_FEATURE_OPTIONS_INSERT_COLUMNS,
    selectFields: APP_FEATURE_OPTIONS_SELECT_COLUMNS,
    insertFields: APP_FEATURE_OPTIONS_INSERT_COLUMNS,
    updateFields: APP_FEATURE_OPTIONS_UPDATE_COLUMNS,
    requiredFields: APP_FEATURE_OPTIONS_REQUIRED_FIELDS,
    searchFields: APP_FEATURE_OPTIONS_SEARCH_FIELDS,
    defaultOrder: APP_FEATURE_OPTIONS_DEFAULT_ORDER,
    columns: APP_FEATURE_OPTIONS_COLUMNS,
    defaults: APP_FEATURE_OPTIONS_DEFAULTS,
    constraints: APP_FEATURE_OPTIONS_CONSTRAINTS,
    indexes: APP_FEATURE_OPTIONS_INDEXES,
    referencedBy: APP_FEATURE_OPTIONS_REFERENCED_BY,
    triggers: APP_FEATURE_OPTIONS_TRIGGERS,
});

export {
    APP_FEATURE_OPTIONS_SCHEMA as catalog_schema,
    APP_FEATURE_OPTIONS_SCHEMA as catalog_schema_appFeatureOptions,
};

export default APP_FEATURE_OPTIONS_SCHEMA;

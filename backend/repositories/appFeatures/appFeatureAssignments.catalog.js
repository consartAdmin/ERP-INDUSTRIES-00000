// ============================================================================
// catalog_schema_appFeatureAssignments.js
// CONSART ERP | PostgreSQL | Node.js ES modules
// Declarative catalog for public."appFeatureAssignments".
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
export const APP_FEATURE_ASSIGNMENTS_SCHEMA_NAME = 'public';
export const APP_FEATURE_ASSIGNMENTS_TABLE_NAME = 'appFeatureAssignments';
export const APP_FEATURE_ASSIGNMENTS_TABLE = 'public."appFeatureAssignments"';
export const APP_FEATURE_ASSIGNMENTS_PRIMARY_KEY = 'feature_assignment_id';

// Literal defaults only. Timestamp expressions are recorded in columns below.
// Repositories must apply these defaults or omit missing columns on INSERT.
// Merely importing this object does not apply defaults to a payload.
export const APP_FEATURE_ASSIGNMENTS_DEFAULTS = Object.freeze({
    is_enabled: true,
});

/**
 * Column metadata in database order.
 * defaultSql === null means no explicit SQL default was supplied.
 * Identity generation is represented separately from an SQL DEFAULT.
 * No bigint-to-Number conversion is performed by this catalog.
 */
export const APP_FEATURE_ASSIGNMENTS_COLUMNS = deepFreeze({
    feature_assignment_id: {
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
    feature_option_id: {
        type: 'bigint',
        nullable: true,
        defaultSql: null,
    },
    scope_type: {
        type: 'character varying(30)',
        maxLength: 30,
        nullable: false,
        defaultSql: null,
    },
    scope_id: {
        type: 'bigint',
        nullable: false,
        defaultSql: null,
    },
    custom_value: {
        type: 'jsonb',
        nullable: true,
        defaultSql: null,
    },
    is_enabled: {
        type: 'boolean',
        nullable: false,
        defaultSql: 'true',
    },
    starts_at: {
        type: 'timestamp with time zone',
        nullable: true,
        defaultSql: null,
    },
    ends_at: {
        type: 'timestamp with time zone',
        nullable: true,
        defaultSql: null,
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

export const APP_FEATURE_ASSIGNMENTS_SELECT_COLUMNS = Object.freeze(
    Object.keys(APP_FEATURE_ASSIGNMENTS_COLUMNS),
);

/**
 * Normal application write lists, not extra database restrictions.
 * Identity and audit timestamps are excluded from ordinary writes.
 * starts_at and ends_at remain writable business fields.
 * BY DEFAULT identity still permits explicit IDs in dedicated import workflows.
 * PostgreSQL enforces the declared relationships when foreign keys are changed.
 */
export const APP_FEATURE_ASSIGNMENTS_INSERT_COLUMNS = Object.freeze([
    'feature_id',
    'feature_option_id',
    'scope_type',
    'scope_id',
    'custom_value',
    'is_enabled',
    'starts_at',
    'ends_at',
]);

export const APP_FEATURE_ASSIGNMENTS_UPDATE_COLUMNS = Object.freeze([
    ...APP_FEATURE_ASSIGNMENTS_INSERT_COLUMNS,
]);

// Required input when creating a row without an explicit identity/timestamps.
// Other NOT NULL columns have identity generation or database defaults.
export const APP_FEATURE_ASSIGNMENTS_REQUIRED_FIELDS = Object.freeze([
    'feature_id',
    'scope_type',
    'scope_id',
]);

// Application search/order conventions; these are not database constraints.
// Only scope_type is a textual search field; bigint fields use typed filters.
export const APP_FEATURE_ASSIGNMENTS_SEARCH_FIELDS = Object.freeze([
    'scope_type',
]);

export const APP_FEATURE_ASSIGNMENTS_DEFAULT_ORDER =
    'scope_type ASC, scope_id ASC, feature_id ASC, feature_assignment_id ASC';

export const APP_FEATURE_ASSIGNMENTS_CONSTRAINTS = deepFreeze({
    primaryKey: {
        name: 'appFeatureAssignments_pkey',
        columns: [APP_FEATURE_ASSIGNMENTS_PRIMARY_KEY],
    },
    // The unique key does not include the period or enabled status.
    unique: [
        {
            name: 'uq_appFeatureAssignments_scope',
            columns: ['scope_type', 'scope_id', 'feature_id'],
        },
    ],
    checks: [
        {
            name: 'ck_appFeatureAssignments_period',
            expression: 'ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at',
        },
        {
            name: 'ck_appFeatureAssignments_scope_type',
            expression: 'scope_type::text = upper(scope_type::text)',
        },
    ],
    // Both outgoing foreign keys belong to appFeatureAssignments.
    // Preserve the option FK's two-column mapping and ON DELETE RESTRICT.
    foreignKeys: [
        {
            name: 'fk_appFeatureAssignments_feature',
            columns: ['feature_id'],
            references: {
                table: 'public."appFeatures"',
                columns: ['feature_id'],
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
        {
            name: 'fk_appFeatureAssignments_option',
            columns: ['feature_id', 'feature_option_id'],
            references: {
                table: 'public."appFeatureOptions"',
                columns: ['feature_id', 'feature_option_id'],
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
        },
    ],
});

// The supplied scope_type check requires uppercase, not a fixed list of scopes.
// No scope enum, scope_id foreign key, positivity check, or option/custom-value
// exclusivity rule is added because none was supplied in the table definition.

// constraintName identifies indexes backing PRIMARY KEY / UNIQUE constraints.
// idx_appFeatureAssignments_lookup is a separate, non-unique index.
export const APP_FEATURE_ASSIGNMENTS_INDEXES = deepFreeze([
    {
        name: 'appFeatureAssignments_pkey',
        method: 'btree',
        unique: true,
        primary: true,
        columns: [APP_FEATURE_ASSIGNMENTS_PRIMARY_KEY],
        constraintName: 'appFeatureAssignments_pkey',
    },
    {
        name: 'idx_appFeatureAssignments_lookup',
        method: 'btree',
        unique: false,
        primary: false,
        columns: ['scope_type', 'scope_id', 'is_enabled'],
        constraintName: null,
    },
    {
        name: 'uq_appFeatureAssignments_scope',
        method: 'btree',
        unique: true,
        primary: false,
        columns: ['scope_type', 'scope_id', 'feature_id'],
        constraintName: 'uq_appFeatureAssignments_scope',
    },
]);

// No incoming foreign-key references were listed in the supplied definition.
export const APP_FEATURE_ASSIGNMENTS_REFERENCED_BY = deepFreeze([]);

// The trigger function body/schema was not supplied; neither is invented here.
export const APP_FEATURE_ASSIGNMENTS_TRIGGERS = deepFreeze([
    {
        name: 'trg_appFeatureAssignments_updatedAt',
        table: APP_FEATURE_ASSIGNMENTS_TABLE,
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
export const APP_FEATURE_ASSIGNMENTS_SCHEMA = deepFreeze({
    schemaName: APP_FEATURE_ASSIGNMENTS_SCHEMA_NAME,
    tableName: APP_FEATURE_ASSIGNMENTS_TABLE_NAME,
    table: APP_FEATURE_ASSIGNMENTS_TABLE,
    idField: APP_FEATURE_ASSIGNMENTS_PRIMARY_KEY,
    primaryKey: APP_FEATURE_ASSIGNMENTS_PRIMARY_KEY,
    fields: APP_FEATURE_ASSIGNMENTS_INSERT_COLUMNS,
    selectFields: APP_FEATURE_ASSIGNMENTS_SELECT_COLUMNS,
    insertFields: APP_FEATURE_ASSIGNMENTS_INSERT_COLUMNS,
    updateFields: APP_FEATURE_ASSIGNMENTS_UPDATE_COLUMNS,
    requiredFields: APP_FEATURE_ASSIGNMENTS_REQUIRED_FIELDS,
    searchFields: APP_FEATURE_ASSIGNMENTS_SEARCH_FIELDS,
    defaultOrder: APP_FEATURE_ASSIGNMENTS_DEFAULT_ORDER,
    columns: APP_FEATURE_ASSIGNMENTS_COLUMNS,
    defaults: APP_FEATURE_ASSIGNMENTS_DEFAULTS,
    constraints: APP_FEATURE_ASSIGNMENTS_CONSTRAINTS,
    indexes: APP_FEATURE_ASSIGNMENTS_INDEXES,
    referencedBy: APP_FEATURE_ASSIGNMENTS_REFERENCED_BY,
    triggers: APP_FEATURE_ASSIGNMENTS_TRIGGERS,
});

export {
    APP_FEATURE_ASSIGNMENTS_SCHEMA as catalog_schema,
    APP_FEATURE_ASSIGNMENTS_SCHEMA as catalog_schema_appFeatureAssignments,
};

export default APP_FEATURE_ASSIGNMENTS_SCHEMA;
// ╔══════════════════════════════════════════════════════════════════════╗
// ║ appFeatures.constants.js — catálogos, tabelas e colunas validadas    ║
// ║ Schemas: appFeatures / appFeatureOptions / appFeatureAssignments     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import appFeaturesSchema from './appFeatures.catalog.js';
import appFeatureOptionsSchema from './appFeatureOptions.catalog.js';
import appFeatureAssignmentsSchema from './appFeatureAssignments.catalog.js';

/* ==========================================================================
   Catalog schemas
   ========================================================================== */

export const SCHEMAS = Object.freeze({
    features: appFeaturesSchema,
    options: appFeatureOptionsSchema,
    assignments: appFeatureAssignmentsSchema,
});

export const TABLES = Object.freeze({
    features: SCHEMAS.features.table,
    options: SCHEMAS.options.table,
    assignments: SCHEMAS.assignments.table,
});

function assertCatalogColumn(schema, columnName) {
    if (!schema?.columns?.[columnName]) {
        throw new Error(
            `Coluna ${columnName} não encontrada no catálogo ${schema?.table ?? 'desconhecido'}.`,
        );
    }

    return columnName;
}

function createColumns(schema, columnNames) {
    return Object.freeze(
        Object.fromEntries(
            columnNames.map((columnName) => [
                columnName,
                assertCatalogColumn(schema, columnName),
            ]),
        ),
    );
}

export const FEATURE_COLUMNS = createColumns(SCHEMAS.features, [
    'feature_id',
    'feature_code',
    'feature_name',
    'description',
    'value_type',
    'default_value',
    'is_active',
    'created_at',
    'updated_at',
]);

export const OPTION_COLUMNS = createColumns(SCHEMAS.options, [
    'feature_option_id',
    'feature_id',
    'option_code',
    'option_name',
    'description',
    'option_config',
    'sort_order',
    'is_active',
]);

export const ASSIGNMENT_COLUMNS = createColumns(SCHEMAS.assignments, [
    'feature_assignment_id',
    'feature_id',
    'feature_option_id',
    'scope_type',
    'scope_id',
    'custom_value',
    'is_enabled',
    'starts_at',
    'ends_at',
    'updated_at',
]);

// Confirma também que as PKs declaradas pelos catálogos continuam compatíveis
// com esta camada. Se houver drift de schema, o erro aparece no startup/import.
if (SCHEMAS.features.primaryKey !== FEATURE_COLUMNS.feature_id) {
    throw new Error('Catálogo appFeatures incompatível: primaryKey inesperada.');
}

if (SCHEMAS.options.primaryKey !== OPTION_COLUMNS.feature_option_id) {
    throw new Error('Catálogo appFeatureOptions incompatível: primaryKey inesperada.');
}

if (SCHEMAS.assignments.primaryKey !== ASSIGNMENT_COLUMNS.feature_assignment_id) {
    throw new Error('Catálogo appFeatureAssignments incompatível: primaryKey inesperada.');
}

export const FEATURE_SELECT_COLUMNS = Object.freeze([
    FEATURE_COLUMNS.feature_id,
    FEATURE_COLUMNS.feature_code,
    FEATURE_COLUMNS.feature_name,
    FEATURE_COLUMNS.description,
    FEATURE_COLUMNS.value_type,
    FEATURE_COLUMNS.default_value,
    FEATURE_COLUMNS.is_active,
    FEATURE_COLUMNS.created_at,
    FEATURE_COLUMNS.updated_at,
]);

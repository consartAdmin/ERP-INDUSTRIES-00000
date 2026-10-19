// ╔══════════════════════════════════════════════════════════════════════╗
// ║ appFeatures.mappers.js — linha do banco → feature / option           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { FEATURE_COLUMNS, OPTION_COLUMNS } from './appFeatures.constants.js';

/* ==========================================================================
   Mappers
   ========================================================================== */

export function mapFeature(row) {
    if (!row) return null;

    return {
        featureId: Number(row[FEATURE_COLUMNS.feature_id]),
        featureCode: row[FEATURE_COLUMNS.feature_code],
        featureName: row[FEATURE_COLUMNS.feature_name],
        description: row[FEATURE_COLUMNS.description],
        valueType: row[FEATURE_COLUMNS.value_type],
        defaultValue: row[FEATURE_COLUMNS.default_value],
        isActive: row[FEATURE_COLUMNS.is_active],
        createdAt: row[FEATURE_COLUMNS.created_at],
        updatedAt: row[FEATURE_COLUMNS.updated_at],
    };
}

export function mapOption(row) {
    if (!row) return null;

    return {
        featureOptionId: Number(row[OPTION_COLUMNS.feature_option_id]),
        optionCode: row[OPTION_COLUMNS.option_code],
        optionName: row[OPTION_COLUMNS.option_name],
        description: row.option_description ?? row[OPTION_COLUMNS.description],
        config: row[OPTION_COLUMNS.option_config] ?? {},
        sortOrder: row[OPTION_COLUMNS.sort_order],
        isActive: row.option_is_active ?? row[OPTION_COLUMNS.is_active],
    };
}

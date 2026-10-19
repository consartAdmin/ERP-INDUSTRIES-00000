// ╔══════════════════════════════════════════════════════════════════════╗
// ║ appFeaturesQuery.repository.js — listFeatures / getFeatureByCode /   ║
// ║ listFeatureOptions                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
    TABLES,
    FEATURE_COLUMNS,
    OPTION_COLUMNS,
    FEATURE_SELECT_COLUMNS,
} from './appFeatures.constants.js';
import { qualified, selectColumns } from './appFeatures.sql.js';
import { getDb } from './appFeaturesDb.repository.js';
import { normalizeCode } from './appFeatures.sanitizers.js';
import { mapFeature, mapOption } from './appFeatures.mappers.js';

/* ==========================================================================
   Feature queries
   ========================================================================== */

export async function listFeatures({ includeInactive = false } = {}) {
    const { rows } = await getDb().query(
        `SELECT
       ${selectColumns('f', FEATURE_SELECT_COLUMNS)}
     FROM ${TABLES.features} f
     WHERE ($1::boolean = TRUE OR ${qualified('f', FEATURE_COLUMNS.is_active)} = TRUE)
     ORDER BY
       ${qualified('f', FEATURE_COLUMNS.feature_name)},
       ${qualified('f', FEATURE_COLUMNS.feature_code)}`,
        [Boolean(includeInactive)],
    );

    return rows.map(mapFeature);
}

export async function getFeatureByCode(featureCode) {
    const code = normalizeCode(featureCode, 'featureCode');

    const { rows } = await getDb().query(
        `SELECT
       ${selectColumns('f', FEATURE_SELECT_COLUMNS)}
     FROM ${TABLES.features} f
     WHERE ${qualified('f', FEATURE_COLUMNS.feature_code)} = $1
     LIMIT 1`,
        [code],
    );

    return mapFeature(rows[0]);
}

export async function listFeatureOptions(
    featureCode,
    { includeInactive = false } = {},
) {
    const code = normalizeCode(featureCode, 'featureCode');

    const { rows } = await getDb().query(
        `SELECT
       ${qualified('o', OPTION_COLUMNS.feature_option_id)},
       ${qualified('o', OPTION_COLUMNS.option_code)},
       ${qualified('o', OPTION_COLUMNS.option_name)},
       ${qualified('o', OPTION_COLUMNS.description)} AS option_description,
       ${qualified('o', OPTION_COLUMNS.option_config)},
       ${qualified('o', OPTION_COLUMNS.sort_order)},
       ${qualified('o', OPTION_COLUMNS.is_active)} AS option_is_active
     FROM ${TABLES.options} o
     JOIN ${TABLES.features} f
       ON ${qualified('f', FEATURE_COLUMNS.feature_id)} = ${qualified('o', OPTION_COLUMNS.feature_id)}
     WHERE ${qualified('f', FEATURE_COLUMNS.feature_code)} = $1
       AND ($2::boolean = TRUE OR ${qualified('o', OPTION_COLUMNS.is_active)} = TRUE)
     ORDER BY
       ${qualified('o', OPTION_COLUMNS.sort_order)},
       ${qualified('o', OPTION_COLUMNS.option_name)},
       ${qualified('o', OPTION_COLUMNS.option_code)}`,
        [code, Boolean(includeInactive)],
    );

    return rows.map(mapOption);
}

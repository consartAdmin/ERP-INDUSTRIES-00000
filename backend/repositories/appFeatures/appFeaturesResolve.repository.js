// ╔══════════════════════════════════════════════════════════════════════╗
// ║ appFeaturesResolve.repository.js — resolveFeature                    ║
// ║ Feature + assignment do escopo + opção ativa (ou default)            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
    TABLES,
    FEATURE_COLUMNS,
    OPTION_COLUMNS,
    ASSIGNMENT_COLUMNS,
} from './appFeatures.constants.js';
import { qualified } from './appFeatures.sql.js';
import { getDb } from './appFeaturesDb.repository.js';
import { normalizeCode, normalizeScopeId } from './appFeatures.sanitizers.js';
import { mapOption } from './appFeatures.mappers.js';

/* ==========================================================================
   Feature resolution
   ========================================================================== */

export async function resolveFeature({
    featureCode,
    scopeType = 'GLOBAL',
    scopeId = 1,
} = {}) {
    const code = normalizeCode(featureCode, 'featureCode');
    const normalizedScopeType = normalizeCode(scopeType, 'scopeType');
    const normalizedScopeId = normalizeScopeId(scopeId);

    const { rows } = await getDb().query(
        `SELECT
       ${qualified('f', FEATURE_COLUMNS.feature_id)},
       ${qualified('f', FEATURE_COLUMNS.feature_code)},
       ${qualified('f', FEATURE_COLUMNS.feature_name)},
       ${qualified('f', FEATURE_COLUMNS.description)},
       ${qualified('f', FEATURE_COLUMNS.value_type)},
       ${qualified('f', FEATURE_COLUMNS.default_value)},
       ${qualified('f', FEATURE_COLUMNS.is_active)} AS feature_is_active,
       ${qualified('a', ASSIGNMENT_COLUMNS.feature_assignment_id)},
       ${qualified('a', ASSIGNMENT_COLUMNS.is_enabled)} AS assignment_is_enabled,
       ${qualified('a', ASSIGNMENT_COLUMNS.custom_value)},
       ${qualified('a', ASSIGNMENT_COLUMNS.starts_at)},
       ${qualified('a', ASSIGNMENT_COLUMNS.ends_at)},
       ${qualified('o', OPTION_COLUMNS.feature_option_id)},
       ${qualified('o', OPTION_COLUMNS.option_code)},
       ${qualified('o', OPTION_COLUMNS.option_name)},
       ${qualified('o', OPTION_COLUMNS.description)} AS option_description,
       ${qualified('o', OPTION_COLUMNS.option_config)},
       ${qualified('o', OPTION_COLUMNS.is_active)} AS option_is_active
     FROM ${TABLES.features} f
     LEFT JOIN ${TABLES.assignments} a
       ON ${qualified('a', ASSIGNMENT_COLUMNS.feature_id)} = ${qualified('f', FEATURE_COLUMNS.feature_id)}
      AND ${qualified('a', ASSIGNMENT_COLUMNS.scope_type)} = $2
      AND ${qualified('a', ASSIGNMENT_COLUMNS.scope_id)} = $3
      AND (${qualified('a', ASSIGNMENT_COLUMNS.starts_at)} IS NULL OR ${qualified('a', ASSIGNMENT_COLUMNS.starts_at)} <= NOW())
      AND (${qualified('a', ASSIGNMENT_COLUMNS.ends_at)} IS NULL OR ${qualified('a', ASSIGNMENT_COLUMNS.ends_at)} > NOW())
     LEFT JOIN ${TABLES.options} o
       ON ${qualified('o', OPTION_COLUMNS.feature_id)} = ${qualified('f', FEATURE_COLUMNS.feature_id)}
      AND ${qualified('o', OPTION_COLUMNS.feature_option_id)} = ${qualified('a', ASSIGNMENT_COLUMNS.feature_option_id)}
     WHERE ${qualified('f', FEATURE_COLUMNS.feature_code)} = $1
     LIMIT 1`,
        [code, normalizedScopeType, normalizedScopeId],
    );

    const row = rows[0];
    if (!row) return null;

    const hasAssignment = row[ASSIGNMENT_COLUMNS.feature_assignment_id] != null;
    const defaultOptionCode = row[FEATURE_COLUMNS.default_value]?.optionCode ?? null;
    const assignedOptionIsUsable =
        Boolean(row[OPTION_COLUMNS.option_code]) && row.option_is_active !== false;
    const optionCode = assignedOptionIsUsable
        ? row[OPTION_COLUMNS.option_code]
        : defaultOptionCode;

    let option = null;

    if (optionCode) {
        const optionResult = await getDb().query(
            `SELECT
         ${OPTION_COLUMNS.feature_option_id},
         ${OPTION_COLUMNS.option_code},
         ${OPTION_COLUMNS.option_name},
         ${OPTION_COLUMNS.description} AS option_description,
         ${OPTION_COLUMNS.option_config},
         ${OPTION_COLUMNS.sort_order},
         ${OPTION_COLUMNS.is_active} AS option_is_active
       FROM ${TABLES.options}
       WHERE ${OPTION_COLUMNS.feature_id} = $1
         AND ${OPTION_COLUMNS.option_code} = $2
         AND ${OPTION_COLUMNS.is_active} = TRUE
       LIMIT 1`,
            [row[FEATURE_COLUMNS.feature_id], optionCode],
        );

        if (optionResult.rows[0]) {
            option = mapOption(optionResult.rows[0]);
        }
    }

    return {
        featureId: Number(row[FEATURE_COLUMNS.feature_id]),
        featureCode: row[FEATURE_COLUMNS.feature_code],
        featureName: row[FEATURE_COLUMNS.feature_name],
        enabled:
            row.feature_is_active &&
            (!hasAssignment || row.assignment_is_enabled === true),
        valueType: row[FEATURE_COLUMNS.value_type],
        optionCode: option?.optionCode ?? optionCode,
        optionName: option?.optionName ?? null,
        config: option?.config ?? {},
        customValue: hasAssignment
            ? row[ASSIGNMENT_COLUMNS.custom_value]
            : row[FEATURE_COLUMNS.default_value],
        source: hasAssignment ? 'ASSIGNMENT' : 'DEFAULT',
        scopeType: normalizedScopeType,
        scopeId: normalizedScopeId,
    };
}

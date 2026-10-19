// ╔══════════════════════════════════════════════════════════════════════╗
// ║ appFeaturesAssignment.repository.js — upsert / remove de assignments ║
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
import { resolveFeature } from './appFeaturesResolve.repository.js';

/* ==========================================================================
   Assignment writes
   ========================================================================== */

export async function upsertFeatureAssignment({
    featureCode,
    scopeType = 'GLOBAL',
    scopeId = 1,
    optionCode = null,
    customValue = null,
    isEnabled = true,
    startsAt = null,
    endsAt = null,
} = {}) {
    const code = normalizeCode(featureCode, 'featureCode');
    const normalizedScopeType = normalizeCode(scopeType, 'scopeType');
    const normalizedScopeId = normalizeScopeId(scopeId);
    const normalizedOptionCode = optionCode
        ? normalizeCode(optionCode, 'optionCode')
        : null;

    const { rows } = await getDb().query(
        `INSERT INTO ${TABLES.assignments} (
       ${ASSIGNMENT_COLUMNS.feature_id},
       ${ASSIGNMENT_COLUMNS.feature_option_id},
       ${ASSIGNMENT_COLUMNS.scope_type},
       ${ASSIGNMENT_COLUMNS.scope_id},
       ${ASSIGNMENT_COLUMNS.custom_value},
       ${ASSIGNMENT_COLUMNS.is_enabled},
       ${ASSIGNMENT_COLUMNS.starts_at},
       ${ASSIGNMENT_COLUMNS.ends_at}
     )
     SELECT
       ${qualified('f', FEATURE_COLUMNS.feature_id)},
       ${qualified('o', OPTION_COLUMNS.feature_option_id)},
       $2,
       $3,
       $5::jsonb,
       $6,
       $7::timestamptz,
       $8::timestamptz
     FROM ${TABLES.features} f
     LEFT JOIN ${TABLES.options} o
       ON ${qualified('o', OPTION_COLUMNS.feature_id)} = ${qualified('f', FEATURE_COLUMNS.feature_id)}
      AND ${qualified('o', OPTION_COLUMNS.option_code)} = $4
      AND ${qualified('o', OPTION_COLUMNS.is_active)} = TRUE
     WHERE ${qualified('f', FEATURE_COLUMNS.feature_code)} = $1
       AND ($4::text IS NULL OR ${qualified('o', OPTION_COLUMNS.feature_option_id)} IS NOT NULL)
     ON CONFLICT (
       ${ASSIGNMENT_COLUMNS.scope_type},
       ${ASSIGNMENT_COLUMNS.scope_id},
       ${ASSIGNMENT_COLUMNS.feature_id}
     )
     DO UPDATE SET
       ${ASSIGNMENT_COLUMNS.feature_option_id} = EXCLUDED.${ASSIGNMENT_COLUMNS.feature_option_id},
       ${ASSIGNMENT_COLUMNS.custom_value} = EXCLUDED.${ASSIGNMENT_COLUMNS.custom_value},
       ${ASSIGNMENT_COLUMNS.is_enabled} = EXCLUDED.${ASSIGNMENT_COLUMNS.is_enabled},
       ${ASSIGNMENT_COLUMNS.starts_at} = EXCLUDED.${ASSIGNMENT_COLUMNS.starts_at},
       ${ASSIGNMENT_COLUMNS.ends_at} = EXCLUDED.${ASSIGNMENT_COLUMNS.ends_at},
       ${ASSIGNMENT_COLUMNS.updated_at} = NOW()
     RETURNING ${ASSIGNMENT_COLUMNS.feature_assignment_id}`,
        [
            code,
            normalizedScopeType,
            normalizedScopeId,
            normalizedOptionCode,
            customValue == null ? null : JSON.stringify(customValue),
            Boolean(isEnabled),
            startsAt,
            endsAt,
        ],
    );

    if (!rows[0]) {
        const error = new Error('Funcionalidade ou opção não encontrada.');
        error.code = 'FEATURE_OR_OPTION_NOT_FOUND';
        throw error;
    }

    return resolveFeature({
        featureCode: code,
        scopeType: normalizedScopeType,
        scopeId: normalizedScopeId,
    });
}

export async function removeFeatureAssignment({
    featureCode,
    scopeType = 'GLOBAL',
    scopeId = 1,
} = {}) {
    const code = normalizeCode(featureCode, 'featureCode');
    const normalizedScopeType = normalizeCode(scopeType, 'scopeType');
    const normalizedScopeId = normalizeScopeId(scopeId);

    const result = await getDb().query(
        `DELETE FROM ${TABLES.assignments} a
     USING ${TABLES.features} f
     WHERE ${qualified('f', FEATURE_COLUMNS.feature_id)} = ${qualified('a', ASSIGNMENT_COLUMNS.feature_id)}
       AND ${qualified('f', FEATURE_COLUMNS.feature_code)} = $1
       AND ${qualified('a', ASSIGNMENT_COLUMNS.scope_type)} = $2
       AND ${qualified('a', ASSIGNMENT_COLUMNS.scope_id)} = $3`,
        [code, normalizedScopeType, normalizedScopeId],
    );

    return result.rowCount > 0;
}

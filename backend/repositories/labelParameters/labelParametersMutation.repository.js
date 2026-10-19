// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelParametersMutation.repository.js — create / update / delete    ║
// ║ Tabela: public."labelParameters"                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { LABEL_PARAMETERS_TABLE } from './labelParameters.constants.js';
import { withClient } from './labelParameters.utils.js';
import {
  normalizePayload,
  validateCreatePayload,
  validateUpdatePayload,
} from './labelParameters.sanitizers.js';
import { buildInsertQuery, buildUpdateQuery } from './labelParameters.sql.js';

/**
 * Create a new label parameter entry
 * @param {object} payload
 */
export async function createLabelParameters(payload) {
  return withClient(async (client) => {
    const normalized = normalizePayload(payload);
    validateCreatePayload(normalized);

    const { text, values } = buildInsertQuery(normalized);
    const result = await client.query(text, values);

    return result.rows[0];
  });
}

/**
 * Update an existing label parameter entry
 * @param {number} id
 * @param {object} payload
 */
export async function updateLabelParameters(id, payload) {
  return withClient(async (client) => {
    const normalized = normalizePayload(payload);
    validateUpdatePayload(normalized);

    const { text, values } = buildUpdateQuery(id, normalized);
    const result = await client.query(text, values);

    return result.rows[0] || null;
  });
}

/**
 * Delete label parameters by ID
 * @param {number} id
 */
export async function deleteLabelParameters(id) {
  return withClient(async (client) => {
    const result = await client.query(
      `
      DELETE FROM ${LABEL_PARAMETERS_TABLE}
      WHERE id = $1
      RETURNING *
      `,
      [id],
    );

    return result.rows[0] || null;
  });
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelParametersQuery.repository.js — list / getById                 ║
// ║ Tabela: public."labelParameters"                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { LABEL_PARAMETERS_TABLE } from './labelParameters.constants.js';
import { withClient } from './labelParameters.utils.js';

/* ======================================================================
   PUBLIC API — labelParameters
   ====================================================================== */

/**
 * List label parameters (optionally filtered by userId and active)
 * @param {{ userId?: number | null, active?: boolean | null }} [filters]
 */
export async function listLabelParameters(filters = {}) {
  const { userId = null, active = null } = filters;

  return withClient(async (client) => {
    const where = [];
    const values = [];

    if (userId !== null && !Number.isNaN(Number(userId))) {
      values.push(Number(userId));
      where.push(`user_id = $${values.length}`);
    }

    if (active !== null) {
      values.push(Boolean(active));
      where.push(`active = $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const query = `
      SELECT
        id,
        user_id,
        name,
        page_width_mm,
        page_height_mm,
        label_width_mm,
        label_height_mm,
        active,
        layout_json,
        created_at,
        updated_at
      FROM ${LABEL_PARAMETERS_TABLE}
      ${whereSql}
      ORDER BY created_at DESC, id DESC;
    `;

    const result = await client.query(query, values);
    return result.rows;
  });
}

/**
 * Get label parameters by ID
 * @param {number} id
 */
export async function getLabelParametersById(id) {
  return withClient(async (client) => {
    const result = await client.query(
      `
      SELECT
        id,
        user_id,
        name,
        page_width_mm,
        page_height_mm,
        label_width_mm,
        label_height_mm,
        active,
        layout_json,
        created_at,
        updated_at
      FROM ${LABEL_PARAMETERS_TABLE}
      WHERE id = $1
      `,
      [id],
    );

    return result.rows[0] || null;
  });
}

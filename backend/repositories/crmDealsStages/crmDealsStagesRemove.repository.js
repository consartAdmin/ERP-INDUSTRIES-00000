// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsStagesRemove.repository.js — removeStage (soft/hard)       ║
// ║ Tabela: public."crmDealsStages"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { normalizeBoolean, normalizeInteger } from './crmDealsStages.sanitizers.js';
import { mapStageRow } from './crmDealsStages.mappers.js';

export async function removeStage(id, options = {}) {
  const stageId = normalizeInteger(id, 0);
  if (!stageId) {
    const err = new Error('ID da etapa inválido.');
    err.status = 400;
    throw err;
  }

  const hardDelete = normalizeBoolean(options.hardDelete, false);

  if (hardDelete) {
    const sql = `
      DELETE FROM public."crmDealsStages"
      WHERE id = $1
      RETURNING
        id,
        stage_name AS name,
        COALESCE(code, stage_code) AS code,
        stage_name,
        stage_code,
        color,
        icon,
        sort_order,
        COALESCE(is_active, TRUE) AS is_active,
        created_at,
        updated_at
    `;

    const { rows } = await pool.query(sql, [stageId]);
    return mapStageRow(rows[0] || null);
  }

  const sql = `
    UPDATE public."crmDealsStages"
    SET
      is_active = FALSE,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      stage_name AS name,
      COALESCE(code, stage_code) AS code,
      stage_name,
      stage_code,
      color,
      icon,
      sort_order,
      COALESCE(is_active, TRUE) AS is_active,
      created_at,
      updated_at
  `;

  const { rows } = await pool.query(sql, [stageId]);
  return mapStageRow(rows[0] || null);
}

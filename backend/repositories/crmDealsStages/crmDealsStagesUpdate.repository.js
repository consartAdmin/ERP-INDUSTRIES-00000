// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsStagesUpdate.repository.js — updateStage                   ║
// ║ Tabela: public."crmDealsStages"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  normalizeBoolean,
  normalizeInteger,
  normalizeText,
  buildCodeFromStageName,
} from './crmDealsStages.sanitizers.js';
import { mapStageRow } from './crmDealsStages.mappers.js';
import { getStageById } from './crmDealsStagesQuery.repository.js';

export async function updateStage(id, payload = {}) {
  const stageId = normalizeInteger(id, 0);
  if (!stageId) {
    const err = new Error('ID da etapa inválido.');
    err.status = 400;
    throw err;
  }

  const current = await getStageById(stageId);
  if (!current) {
    const err = new Error('Etapa não encontrada.');
    err.status = 404;
    throw err;
  }

  const stage_name =
    payload.stage_name !== undefined
      ? normalizeText(payload.stage_name, current.stage_name)
      : current.stage_name;

  const stage_code =
    payload.stage_code !== undefined
      ? normalizeText(payload.stage_code, current.stage_code || buildCodeFromStageName(stage_name))
      : (current.stage_code || buildCodeFromStageName(stage_name));

  const code =
    payload.code !== undefined
      ? normalizeText(payload.code, current.code || stage_code)
      : (current.code || stage_code);

  const color =
    payload.color !== undefined
      ? normalizeText(payload.color, current.color || '#cbd5e1')
      : (current.color || '#cbd5e1');

  const icon =
    payload.icon !== undefined
      ? normalizeText(payload.icon, current.icon || '')
      : (current.icon || '');

  const sort_order =
    payload.sort_order !== undefined
      ? normalizeInteger(payload.sort_order, current.sort_order || 0)
      : (current.sort_order || 0);

  const is_active =
    payload.is_active !== undefined
      ? normalizeBoolean(payload.is_active, current.is_active)
      : current.is_active;

  if (!stage_name) {
    const err = new Error('O campo "stage_name" é obrigatório.');
    err.status = 400;
    throw err;
  }

  if (!stage_code) {
    const err = new Error('O campo "stage_code" é obrigatório.');
    err.status = 400;
    throw err;
  }

  const sql = `
    UPDATE public."crmDealsStages"
    SET
      stage_name = $2,
      stage_code = $3,
      color = $4,
      icon = $5,
      sort_order = $6,
      is_active = $7,
      code = $8,
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

  try {
    const { rows } = await pool.query(sql, [
      stageId,
      stage_name,
      stage_code,
      color,
      icon || null,
      sort_order,
      is_active,
      code || null,
    ]);

    return mapStageRow(rows[0] || null);
  } catch (error) {
    if (
      String(error?.message || '').includes('crmDealsStages_stage_code_key') ||
      error?.constraint === 'crmDealsStages_stage_code_key'
    ) {
      const err = new Error('Já existe uma etapa com este stage_code.');
      err.status = 409;
      throw err;
    }
    throw error;
  }
}

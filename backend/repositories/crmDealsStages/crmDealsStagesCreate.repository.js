// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsStagesCreate.repository.js — createStage                   ║
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

export async function createStage(payload = {}) {
  const stage_name = normalizeText(payload.stage_name);
  const generatedCode = buildCodeFromStageName(stage_name);

  const stage_code = normalizeText(payload.stage_code || generatedCode);
  const code = normalizeText(payload.code || stage_code);
  const color = normalizeText(payload.color || '#cbd5e1');
  const icon = normalizeText(payload.icon || '');
  const sort_order = normalizeInteger(payload.sort_order, 0);
  const is_active = normalizeBoolean(payload.is_active, true);

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
    INSERT INTO public."crmDealsStages" (
      stage_name,
      stage_code,
      color,
      icon,
      sort_order,
      is_active,
      code,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
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

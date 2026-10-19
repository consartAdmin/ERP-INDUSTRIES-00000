// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsStages.repository.js — listStages / getStageById /         ║
// ║ getStageByCode | Tabela: public."crmDealsStages"                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { buildError } from './crmDeals.utils.js';
import { mapStageRow } from './crmDeals.mappers.js';

/* =========================================================================
 * STAGES
 * ========================================================================= */
export async function listStages({ includeInactive = false } = {}) {
  try {
    const params = [];
    let where = 'WHERE 1=1';

    const activeExpr = `COALESCE(s.is_active, TRUE)`;

    if (!includeInactive) {
      params.push(true);
      where += ` AND ${activeExpr} = $${params.length}`;
    }

    const sql = `
      SELECT
        s.id,
        COALESCE(s.code, s.stage_code) AS code,
        s.stage_name AS name,
        s.stage_name,
        s.stage_code,
        s.color,
        s.icon,
        s.sort_order,
        COALESCE(s.is_active, TRUE) AS is_active,
        s.created_at,
        s.updated_at
      FROM public."crmDealsStages" s
      ${where}
      ORDER BY ${activeExpr} DESC, s.sort_order ASC, s.id ASC
    `;

    const { rows } = await pool.query(sql, params);
    return { ok: true, data: rows.map(mapStageRow) };
  } catch (err) {
    return buildError(err, 'crmDealsApi.listStages');
  }
}

export async function getStageById(id) {
  try {
    const sql = `
      SELECT
        s.id,
        COALESCE(s.code, s.stage_code) AS code,
        s.stage_name AS name,
        s.stage_name,
        s.stage_code,
        s.color,
        s.icon,
        s.sort_order,
        COALESCE(s.is_active, TRUE) AS is_active,
        s.created_at,
        s.updated_at
      FROM public."crmDealsStages" s
      WHERE s.id = $1
    `;
    const { rows } = await pool.query(sql, [id]);
    if (!rows[0]) return { ok: false, error: 'STAGE_NOT_FOUND' };
    return { ok: true, data: mapStageRow(rows[0]) };
  } catch (err) {
    return buildError(err, 'crmDealsApi.getStageById');
  }
}

export async function getStageByCode(code) {
  try {
    const sql = `
      SELECT
        s.id,
        COALESCE(s.code, s.stage_code) AS code,
        s.stage_name AS name,
        s.stage_name,
        s.stage_code,
        s.color,
        s.icon,
        s.sort_order,
        COALESCE(s.is_active, TRUE) AS is_active,
        s.created_at,
        s.updated_at
      FROM public."crmDealsStages" s
      WHERE UPPER(COALESCE(s.code, s.stage_code)) = UPPER($1)
    `;
    const { rows } = await pool.query(sql, [code]);
    if (!rows[0]) return { ok: false, error: 'STAGE_NOT_FOUND' };
    return { ok: true, data: mapStageRow(rows[0]) };
  } catch (err) {
    return buildError(err, 'crmDealsApi.getStageByCode');
  }
}

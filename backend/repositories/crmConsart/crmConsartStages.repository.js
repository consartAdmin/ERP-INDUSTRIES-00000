// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmConsartStages.repository.js — listStages / getStageById /       ║
// ║ getStageByCode | Tabela: public."crmStagesReativation"             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { buildError } from './crmConsart.utils.js';
import { mapStageRow } from './crmConsart.mappers.js';

/* =========================================================================
 * STAGES (colunas do Kanban)
 * ========================================================================= */

export async function listStages({ includeInactive = false } = {}) {
  try {
    const params = [];
    let where = 'WHERE 1=1';

    if (!includeInactive) {
      params.push(true);
      where += ` AND s.active = $${params.length}`;
    }

    const sql = `
      SELECT
        s.id,
        s.code,
        s.name,
        s.color,
        s.sort_order,
        s.active,
        s.created_at,
        s.updated_at
      FROM public."crmStagesReativation" s
      ${where}
      ORDER BY s.active DESC, s.sort_order ASC, s.id ASC
    `;

    const { rows } = await pool.query(sql, params);
    return { ok: true, data: rows.map(mapStageRow) };
  } catch (err) {
    return buildError(err, 'crmConsartApi.listStages');
  }
}

export async function getStageById(id) {
  try {
    const sql = `
      SELECT
        s.id,
        s.code,
        s.name,
        s.color,
        s.sort_order,
        s.active,
        s.created_at,
        s.updated_at
      FROM public."crmStagesReativation" s
      WHERE s.id = $1
    `;
    const { rows } = await pool.query(sql, [id]);
    if (!rows[0]) return { ok: false, error: 'STAGE_NOT_FOUND' };
    return { ok: true, data: mapStageRow(rows[0]) };
  } catch (err) {
    return buildError(err, 'crmConsartApi.getStageById');
  }
}

export async function getStageByCode(code) {
  try {
    const sql = `
      SELECT
        s.id,
        s.code,
        s.name,
        s.color,
        s.sort_order,
        s.active,
        s.created_at,
        s.updated_at
      FROM public."crmStagesReativation" s
      WHERE UPPER(s.code) = UPPER($1)
    `;
    const { rows } = await pool.query(sql, [code]);
    if (!rows[0]) return { ok: false, error: 'STAGE_NOT_FOUND' };
    return { ok: true, data: mapStageRow(rows[0]) };
  } catch (err) {
    return buildError(err, 'crmConsartApi.getStageByCode');
  }
}

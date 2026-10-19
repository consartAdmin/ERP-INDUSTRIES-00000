// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsStagesQuery.repository.js — listStages / countStages /     ║
// ║ getStageById | Tabela: public."crmDealsStages"                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { normalizeBoolean, normalizeInteger, normalizeText } from './crmDealsStages.sanitizers.js';
import { mapStageRow } from './crmDealsStages.mappers.js';
import { buildStageSelectSql } from './crmDealsStages.sql.js';

export async function listStages(params = {}) {
  const q = normalizeText(params.q);
  const onlyActive =
    params.only_active === undefined
      ? true
      : normalizeBoolean(params.only_active, true);

  const limit = Math.max(1, Math.min(500, normalizeInteger(params.limit, 100)));
  const offset = Math.max(0, normalizeInteger(params.offset, 0));

  const values = [];
  const where = [];

  if (onlyActive) {
    values.push(true);
    where.push(`COALESCE(s.is_active, TRUE) = $${values.length}`);
  }

  if (q) {
    values.push(`%${q}%`);
    const idx = values.length;
    where.push(`(
      s.stage_name ILIKE $${idx}
      OR s.stage_code ILIKE $${idx}
      OR COALESCE(s.code, '') ILIKE $${idx}
      OR COALESCE(s.icon, '') ILIKE $${idx}
    )`);
  }

  values.push(limit);
  const limitIndex = values.length;

  values.push(offset);
  const offsetIndex = values.length;

  const sql = `
    ${buildStageSelectSql()}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY COALESCE(s.sort_order, 0) ASC, s.stage_name ASC, s.id ASC
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
  `;

  const { rows } = await pool.query(sql, values);
  return rows.map(mapStageRow);
}

export async function countStages(params = {}) {
  const q = normalizeText(params.q);
  const onlyActive =
    params.only_active === undefined
      ? true
      : normalizeBoolean(params.only_active, true);

  const values = [];
  const where = [];

  if (onlyActive) {
    values.push(true);
    where.push(`COALESCE(s.is_active, TRUE) = $${values.length}`);
  }

  if (q) {
    values.push(`%${q}%`);
    const idx = values.length;
    where.push(`(
      s.stage_name ILIKE $${idx}
      OR s.stage_code ILIKE $${idx}
      OR COALESCE(s.code, '') ILIKE $${idx}
      OR COALESCE(s.icon, '') ILIKE $${idx}
    )`);
  }

  const sql = `
    SELECT COUNT(*)::int AS total
    FROM public."crmDealsStages" s
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `;

  const { rows } = await pool.query(sql, values);
  return rows[0]?.total || 0;
}

export async function getStageById(id) {
  const stageId = normalizeInteger(id, 0);
  if (!stageId) return null;

  const sql = `
    ${buildStageSelectSql()}
    WHERE s.id = $1
    LIMIT 1
  `;

  const { rows } = await pool.query(sql, [stageId]);
  return mapStageRow(rows[0] || null);
}

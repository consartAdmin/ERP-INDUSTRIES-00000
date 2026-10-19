// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalClassificationQuery.repository.js — getById / list           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PROFILE, ALIAS_PROFILE, TB, ALIAS } from './fiscalClassification.constants.js';
import { normalizeRow } from './fiscalClassification.mappers.js';

export async function getById(id) {
  const sql = `
    SELECT
      ${ALIAS}.*,
      ${ALIAS_PROFILE}.profile_name AS fiscal_profile_name
    FROM ${TB} ${ALIAS}
    LEFT JOIN ${TB_PROFILE} ${ALIAS_PROFILE}
      ON ${ALIAS}.fiscal_profile_id = ${ALIAS_PROFILE}.fiscal_profile_id
    WHERE ${ALIAS}.fiscal_classification_id = $1;
  `;
  const { rows } = await pool.query(sql, [Number(id)]);
  return rows[0] ? normalizeRow(rows[0]) : null;
}

export async function list(params = {}) {
  const {
    q,
    limit = 20,
    offset = 0,
    orderBy = 'classification_name ASC'
  } = params;

  const where = [];
  const vals = [];
  let i = 1;

  if (q) {
    where.push(`(
      LOWER(${ALIAS}.classification_name) LIKE $${i}
      OR LOWER(${ALIAS}.ncm_code) LIKE $${i}
      OR LOWER(${ALIAS}.cest_code) LIKE $${i}
      OR LOWER(${ALIAS}.ncm_description) LIKE $${i}
      OR LOWER(${ALIAS}.cest_description) LIKE $${i}
      OR LOWER(${ALIAS_PROFILE}.profile_name) LIKE $${i}
    )`);
    vals.push(`%${String(q).toLowerCase()}%`);
    i++;
  }

  const sql = `
    SELECT
      ${ALIAS}.*,
      ${ALIAS_PROFILE}.profile_name AS fiscal_profile_name
    FROM ${TB} ${ALIAS}
    LEFT JOIN ${TB_PROFILE} ${ALIAS_PROFILE}
      ON ${ALIAS}.fiscal_profile_id = ${ALIAS_PROFILE}.fiscal_profile_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY ${orderBy}
    LIMIT $${i++} OFFSET $${i};
  `;
  vals.push(Number(limit), Number(offset));

  const { rows } = await pool.query(sql, vals);

  const { rows: totalRows } = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM ${TB} ${ALIAS}
    LEFT JOIN ${TB_PROFILE} ${ALIAS_PROFILE}
      ON ${ALIAS}.fiscal_profile_id = ${ALIAS_PROFILE}.fiscal_profile_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
  `, where.length ? [vals[0]] : []);

  return {
    rows: rows.map(normalizeRow),
    total: totalRows[0]?.total ?? 0,
    limit: Number(limit),
    offset: Number(offset)
  };
}

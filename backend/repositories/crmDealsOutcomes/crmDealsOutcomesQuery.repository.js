// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsOutcomesQuery.repository.js — list / getById / getByCode   ║
// ║ Tabela: "crmDealsOutcomes"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE, DEFAULT_ORDER } from './crmDealsOutcomes.constants.js';
import { normalizeBoolean, normalizeInteger, normalizeText } from './crmDealsOutcomes.sanitizers.js';
import { buildSearchClause } from './crmDealsOutcomes.sql.js';

export async function listCrmDealsOutcomes({
  q = '',
  is_active,
  limit = 100,
  offset = 0
} = {}) {
  const where = [];
  const values = [];

  if (is_active !== undefined && is_active !== null && is_active !== '') {
    values.push(normalizeBoolean(is_active, true));
    where.push(`is_active = $${values.length}`);
  }

  const search = buildSearchClause(q, values.length + 1);
  if (search.clause) {
    values.push(...search.values);
    where.push(search.clause);
  }

  values.push(normalizeInteger(limit, 100));
  const limitIndex = values.length;

  values.push(normalizeInteger(offset, 0));
  const offsetIndex = values.length;

  const sql = `
    SELECT
      id,
      name,
      icon,
      color,
      sort_order,
      is_active,
      created_at,
      code,
      outcome_type
    FROM ${TABLE}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${DEFAULT_ORDER}
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
  `;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM ${TABLE}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `;

  const countValues = values.slice(0, values.length - 2);

  const [rowsResult, countResult] = await Promise.all([
    pool.query(sql, values),
    pool.query(countSql, countValues)
  ]);

  return {
    items: rowsResult.rows,
    total: countResult.rows[0]?.total || 0,
    limit: normalizeInteger(limit, 100),
    offset: normalizeInteger(offset, 0)
  };
}

export async function getCrmDealsOutcomeById(id) {
  const sql = `
    SELECT
      id,
      name,
      icon,
      color,
      sort_order,
      is_active,
      created_at,
      code,
      outcome_type
    FROM ${TABLE}
    WHERE id = $1
    LIMIT 1
  `;

  const { rows } = await pool.query(sql, [normalizeInteger(id, 0)]);
  return rows[0] || null;
}

export async function getCrmDealsOutcomeByCode(code) {
  const sql = `
    SELECT
      id,
      name,
      icon,
      color,
      sort_order,
      is_active,
      created_at,
      code,
      outcome_type
    FROM ${TABLE}
    WHERE code = $1
    LIMIT 1
  `;

  const { rows } = await pool.query(sql, [normalizeText(code, '')]);
  return rows[0] || null;
}

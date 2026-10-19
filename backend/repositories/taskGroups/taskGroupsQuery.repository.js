// ╔════════════════════════════════════════════════════════════════════╗
// ║ taskGroupsQuery.repository.js — list / getById                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './taskGroups.constants.js';
import { toBool } from './taskGroups.sanitizers.js';
import { ensureTable } from './taskGroupsSchema.repository.js';

export async function list({ q = '', active = '', page = 1, limit = 50 } = {}) {
  await ensureTable();

  page = Math.max(Number(page) || 1, 1);
  limit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];

  if (q) {
    params.push(`%${q}%`);
    where.push(`name ILIKE $${params.length}`);
  }

  if (active !== '') {
    params.push(toBool(active));
    where.push(`is_active = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `
    SELECT
      task_group_id,
      name,
      color,
      icon,
      sort_order,
      is_active,
      created_at,
      updated_at
    FROM ${TB}
    ${whereSql}
    ORDER BY sort_order ASC, name ASC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    [...params, limit, offset]
  );

  const totalResult = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM ${TB}
    ${whereSql}
    `,
    params
  );

  return {
    rows,
    total: totalResult.rows[0]?.total || 0,
    page,
    limit,
  };
}

export async function getById(id) {
  await ensureTable();

  const { rows } = await pool.query(
    `
    SELECT *
    FROM ${TB}
    WHERE task_group_id = $1
    `,
    [id]
  );

  return rows[0] || null;
}

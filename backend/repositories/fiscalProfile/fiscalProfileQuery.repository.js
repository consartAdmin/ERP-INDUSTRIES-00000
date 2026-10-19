// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalProfileQuery.repository.js — list / getById                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './fiscalProfile.constants.js';
import { ensureTable } from './fiscalProfileSchema.repository.js';

export async function list({ q = '', limit = 20, offset = 0 } = {}) {
  await ensureTable();
  const safeLimit = Number.isInteger(Number(limit))
    ? Math.min(100, Math.max(1, Number(limit)))
    : 20;
  const safeOffset = Number.isInteger(Number(offset))
    ? Math.max(0, Number(offset))
    : 0;
  const params = [];
  let where = 'WHERE is_active IS TRUE';

  if (q) {
    params.push(`%${String(q).toLowerCase()}%`);
    where += ` AND (
      LOWER(profile_name) LIKE $1
      OR LOWER(COALESCE(description, '')) LIKE $1
    )`;
  }

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM ${TB} ${where}`,
    params,
  );
  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const { rows } = await pool.query(
    `SELECT * FROM ${TB} ${where}
     ORDER BY updated_at DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    [...params, safeLimit, safeOffset],
  );

  return {
    rows,
    total: countRes.rows[0]?.total ?? 0,
    limit: safeLimit,
    offset: safeOffset,
  };
}

export async function getById(id) {
  await ensureTable();
  const { rows } = await pool.query(
    `SELECT * FROM ${TB} WHERE fiscal_profile_id = $1 LIMIT 1`,
    [Number(id)],
  );
  return rows[0] || null;
}

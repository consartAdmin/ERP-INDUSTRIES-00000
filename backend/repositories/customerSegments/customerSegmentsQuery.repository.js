// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerSegmentsQuery.repository.js — list() / getById()           ║
// ║ Tabela: public."customerSegments"                                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl } from './customerSegments.constants.js';
import { toBool } from './customerSegments.sanitizers.js';
import { ensureTable } from './customerSegmentsSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   list()
────────────────────────────────────────────────────────────── */
export async function list({
  q = '',
  active,
  limit = 20,
  offset = 0
} = {}) {
  await ensureTable();

  const params = [];
  const whereParts = [];

  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    whereParts.push(`(
      LOWER(segment_name) LIKE $${params.length}
      OR LOWER(COALESCE(description,'')) LIKE $${params.length}
      OR LOWER(COALESCE(segment_code,'')) LIKE $${params.length}
    )`);
  }

  const bActive = toBool(active);
  if (bActive !== null) {
    params.push(bActive);
    whereParts.push(`is_active = $${params.length}`);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM ${tbl()} ${whereSql};`,
    params
  );

  const total = countRes.rows?.[0]?.total || 0;

  const { rows } = await pool.query(
    `
      SELECT *
      FROM ${tbl()}
      ${whereSql}
      ORDER BY segment_name ASC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)};
    `,
    params
  );

  return { rows, total, limit: Number(limit), offset: Number(offset) };
}

/* ──────────────────────────────────────────────────────────────
   getById()
────────────────────────────────────────────────────────────── */
export async function getById(id) {
  await ensureTable();

  const { rows } = await pool.query(
    `SELECT * FROM ${tbl()} WHERE segment_id = $1 LIMIT 1;`,
    [Number(id)]
  );

  return rows[0] || null;
}

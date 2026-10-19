// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerSubSegmentsQuery.repository.js — list() / getById()        ║
// ║ Tabela: public."customerSubSegments"                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl } from './customerSubSegments.constants.js';
import { toBool } from './customerSubSegments.sanitizers.js';
import { ensureTable } from './customerSubSegmentsSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   list()
────────────────────────────────────────────────────────────── */
export async function list({
  q = '',
  segment_id,
  active,
  limit = 20,
  offset = 0
} = {}) {
  await ensureTable();
  // limit/offset entram no SQL por interpolação: força inteiros para evitar SQL injection
  limit = Math.max(Number.parseInt(limit, 10) || 20, 1);
  offset = Math.max(Number.parseInt(offset, 10) || 0, 0);
  const params = [];
  const whereParts = [];

  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    whereParts.push(`(LOWER(subsegment_name) LIKE $${params.length}
                     OR LOWER(COALESCE(description,'')) LIKE $${params.length})`);
  }

  if (segment_id) {
    params.push(Number(segment_id));
    whereParts.push(`segment_id = $${params.length}`);
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
      ORDER BY subsegment_name ASC
      LIMIT ${limit} OFFSET ${offset};
    `,
    params
  );

  return { rows, total, limit, offset };
}

/* ──────────────────────────────────────────────────────────────
   getById()
────────────────────────────────────────────────────────────── */
export async function getById(id) {
  await ensureTable();
  const { rows } = await pool.query(
    `SELECT * FROM ${tbl()} WHERE subsegment_id = $1 LIMIT 1;`,
    [Number(id)]
  );
  return rows[0] || null;
}

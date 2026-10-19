// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerSegmentsUpdate.repository.js — update() / remove()         ║
// ║ update não altera segment_code; remove é soft por padrão           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl, nowSql } from './customerSegments.constants.js';
import { normalizePayload } from './customerSegments.sanitizers.js';
import { ensureTable } from './customerSegmentsSchema.repository.js';
import { getById } from './customerSegmentsQuery.repository.js';

/* ──────────────────────────────────────────────────────────────
   update() — não altera segment_code
────────────────────────────────────────────────────────────── */
export async function update(id, input = {}) {
  await ensureTable();

  const data = normalizePayload(input);

  if (!Object.keys(data).length) {
    return getById(id);
  }

  const sets = [];
  const vals = [];

  Object.entries(data).forEach(([col, val]) => {
    vals.push(val);
    sets.push(`${col} = $${vals.length}`);
  });

  const sql = `
    UPDATE ${tbl()}
    SET ${sets.join(', ')}, updated_at = ${nowSql}
    WHERE segment_id = $${vals.length + 1}
    RETURNING *;
  `;

  const { rows } = await pool.query(sql, [...vals, Number(id)]);
  return rows[0] || null;
}

/* ──────────────────────────────────────────────────────────────
   remove()
────────────────────────────────────────────────────────────── */
export async function remove(id, { hard = false } = {}) {
  await ensureTable();

  if (hard) {
    await pool.query(`DELETE FROM ${tbl()} WHERE segment_id = $1;`, [Number(id)]);
    return { ok: true, hard: true };
  }

  await pool.query(
    `
      UPDATE ${tbl()}
      SET is_active = FALSE, updated_at = ${nowSql}
      WHERE segment_id = $1;
    `,
    [Number(id)]
  );

  return { ok: true, hard: false };
}

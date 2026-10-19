// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerSubSegmentsUpdate.repository.js — update() / remove()      ║
// ║ update não altera subsegment_code; remove é soft por padrão        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl, nowSql } from './customerSubSegments.constants.js';
import { normalizePayload } from './customerSubSegments.sanitizers.js';
import { ensureTable } from './customerSubSegmentsSchema.repository.js';
import { getById } from './customerSubSegmentsQuery.repository.js';

/* ──────────────────────────────────────────────────────────────
   update() — não altera subsegment_code
────────────────────────────────────────────────────────────── */
export async function update(id, input = {}) {
  await ensureTable();
  const data = normalizePayload(input);
  if (!Object.keys(data).length) return getById(id);

  const sets = [];
  const vals = [];

  Object.entries(data).forEach(([col, val]) => {
    vals.push(val);
    sets.push(`${col} = $${vals.length}`);
  });

  const sql = `
    UPDATE ${tbl()}
    SET ${sets.join(', ')}, updated_at = ${nowSql}
    WHERE subsegment_id = $${vals.length + 1}
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
    await pool.query(`DELETE FROM ${tbl()} WHERE subsegment_id = $1;`, [Number(id)]);
    return { ok: true, hard: true };
  }
  await pool.query(
    `UPDATE ${tbl()} SET is_active = FALSE, updated_at = ${nowSql} WHERE subsegment_id = $1;`,
    [Number(id)]
  );
  return { ok: true, hard: false };
}

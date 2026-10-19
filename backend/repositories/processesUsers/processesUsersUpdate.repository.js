// ╔════════════════════════════════════════════════════════════════════╗
// ║ processesUsersUpdate.repository.js — update (parcial)              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, nowSql } from './processesUsers.constants.js';
import { normalizePayload } from './processesUsers.sanitizers.js';
import { ensureTable } from './processesUsersSchema.repository.js';
import { getById } from './processesUsersQuery.repository.js';

/* ──────────────────────────────────────────────────────────────
   update() — Atualização parcial
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
    UPDATE ${TB}
    SET ${sets.join(', ')}, updated_at = ${nowSql}
    WHERE id = $${vals.length + 1}
    RETURNING *;
  `;

  const { rows } = await pool.query(sql, [...vals, Number(id)]);
  return rows[0] || null;
}

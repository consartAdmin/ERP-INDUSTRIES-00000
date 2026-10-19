// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalProfileUpdate.repository.js — update                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, nowSql } from './fiscalProfile.constants.js';
import { normalizePayload } from './fiscalProfile.sanitizers.js';
import { ensureTable } from './fiscalProfileSchema.repository.js';
import { getById } from './fiscalProfileQuery.repository.js';

export async function update(id, input = {}) {
  await ensureTable();
  const data = normalizePayload(input);
  if (!Object.keys(data).length) return getById(id);

  const vals = [];
  const sets = Object.entries(data).map(([col, value]) => {
    vals.push(value);
    return `${col} = $${vals.length}`;
  });
  const { rows } = await pool.query(
    `UPDATE ${TB}
     SET ${sets.join(', ')}, updated_at = ${nowSql}
     WHERE fiscal_profile_id = $${vals.length + 1}
     RETURNING *`,
    [...vals, Number(id)],
  );
  return rows[0] || null;
}

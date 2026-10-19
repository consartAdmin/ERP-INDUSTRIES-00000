// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalProfileCreate.repository.js — create                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './fiscalProfile.constants.js';
import { normalizePayload } from './fiscalProfile.sanitizers.js';
import { ensureTable } from './fiscalProfileSchema.repository.js';

export async function create(input = {}) {
  await ensureTable();
  const data = normalizePayload(input);
  if (!data.profile_name) throw new Error('profile_name is required');

  const cols = Object.keys(data);
  const vals = Object.values(data);
  const params = vals.map((_, index) => `$${index + 1}`);
  const { rows } = await pool.query(
    `INSERT INTO ${TB} (${cols.join(', ')})
     VALUES (${params.join(', ')}) RETURNING *`,
    vals,
  );
  return rows[0];
}

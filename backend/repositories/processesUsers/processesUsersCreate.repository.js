// ╔════════════════════════════════════════════════════════════════════╗
// ║ processesUsersCreate.repository.js — create (UPSERT process/user)  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS, nowSql } from './processesUsers.constants.js';
import { normalizePayload } from './processesUsers.sanitizers.js';
import { ensureTable } from './processesUsersSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   create() — UPSERT por (process_id, user_id)
────────────────────────────────────────────────────────────── */
export async function create(input = {}) {
  await ensureTable();
  const data = normalizePayload(input);

  if (!data.process_id) throw new Error('process_id é obrigatório.');
  if (!data.user_id) throw new Error('user_id é obrigatório.');

  const cols = Object.keys(data);
  const vals = Object.values(data);
  const params = vals.map((_, i) => `$${i + 1}`);

  const setUpdates = cols
    .filter((c) => !['process_id', 'user_id'].includes(c))
    .map((c) => `${c} = COALESCE(EXCLUDED.${c}, ${ALIAS}.${c})`);

  const sql = `
    INSERT INTO ${TB} AS ${ALIAS} (${cols.join(', ')})
    VALUES (${params.join(', ')})
    ON CONFLICT (process_id, user_id) DO UPDATE
    SET ${setUpdates.length ? setUpdates.join(', ') + ',' : ''} 
        deleted_at = NULL,
        updated_at = ${nowSql}
    RETURNING *;
  `;

  const { rows } = await pool.query(sql, vals);
  return rows[0];
}

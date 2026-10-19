// ╔════════════════════════════════════════════════════════════════════╗
// ║ taskGroupsRemove.repository.js — remove (soft) / restore           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './taskGroups.constants.js';
import { ensureTable } from './taskGroupsSchema.repository.js';

export async function remove(id) {
  await ensureTable();

  const { rows } = await pool.query(
    `
    UPDATE ${TB}
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE task_group_id = $1
    RETURNING *
    `,
    [id]
  );

  return rows[0] || null;
}

export async function restore(id) {
  await ensureTable();

  const { rows } = await pool.query(
    `
    UPDATE ${TB}
    SET is_active = TRUE,
        updated_at = NOW()
    WHERE task_group_id = $1
    RETURNING *
    `,
    [id]
  );

  return rows[0] || null;
}

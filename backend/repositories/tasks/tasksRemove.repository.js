// ╔════════════════════════════════════════════════════════════════════╗
// ║ tasksRemove.repository.js — deleteTask                             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_TASKS } from './tasks.constants.js';
import { ensureTasksGroupColumn } from './tasksSchema.repository.js';

export async function deleteTask(id) {
  await ensureTasksGroupColumn();

  const { rowCount } = await pool.query(
    `
    DELETE FROM ${TB_TASKS}
    WHERE id = $1
    `,
    [id]
  );

  return rowCount > 0;
}

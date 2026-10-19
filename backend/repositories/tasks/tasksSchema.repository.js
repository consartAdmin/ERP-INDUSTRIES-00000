// ╔════════════════════════════════════════════════════════════════════╗
// ║ tasksSchema.repository.js — ensureTasksGroupColumn                 ║
// ║ Coluna task_group_id + FK + índice                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_TASKS, TB_TASK_GROUPS } from './tasks.constants.js';

export async function ensureTasksGroupColumn() {
  await pool.query(`
    ALTER TABLE ${TB_TASKS}
    ADD COLUMN IF NOT EXISTS task_group_id INTEGER;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_tasks_task_group'
      ) THEN
        ALTER TABLE ${TB_TASKS}
        ADD CONSTRAINT fk_tasks_task_group
        FOREIGN KEY (task_group_id)
        REFERENCES ${TB_TASK_GROUPS}(task_group_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_task_group_id
    ON ${TB_TASKS} (task_group_id);
  `);
}

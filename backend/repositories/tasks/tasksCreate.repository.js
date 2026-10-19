// ╔════════════════════════════════════════════════════════════════════╗
// ║ tasksCreate.repository.js — createTask                             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_TASKS } from './tasks.constants.js';
import { toNull, toBool, toIntOrNull } from './tasks.sanitizers.js';
import { ensureTasksGroupColumn } from './tasksSchema.repository.js';

export async function createTask(data = {}) {
  await ensureTasksGroupColumn();

  const {
    title,
    description,
    status,
    assigned_to,
    created_by,
    priority,
    started_at,
    finished_at,
    duration_ms,
    observations,
    active,
    task_group_id,
    taskGroupId,
  } = data;

  const { rows } = await pool.query(
    `
    INSERT INTO ${TB_TASKS} (
      title,
      description,
      status,
      assigned_to,
      created_by,
      priority,
      started_at,
      finished_at,
      duration_ms,
      observations,
      active,
      task_group_id
    )
    VALUES (
      $1,
      $2,
      COALESCE($3, 'OPEN'),
      $4,
      $5,
      COALESCE($6, 'NORMAL'),
      $7,
      $8,
      COALESCE($9, 0),
      $10,
      COALESCE($11, TRUE),
      $12
    )
    RETURNING *
    `,
    [
      title,
      toNull(description),
      toNull(status),
      toNull(assigned_to),
      toNull(created_by),
      toNull(priority),
      toNull(started_at),
      toNull(finished_at),
      toNull(duration_ms),
      toNull(observations),
      active === undefined ? true : toBool(active, true),
      toIntOrNull(task_group_id ?? taskGroupId),
    ]
  );

  return rows[0];
}

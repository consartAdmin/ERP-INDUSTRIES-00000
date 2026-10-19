// ╔════════════════════════════════════════════════════════════════════╗
// ║ tasksUpdate.repository.js — updateTask / finishTask                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_TASKS } from './tasks.constants.js';
import { toNull, toBool, toIntOrNull } from './tasks.sanitizers.js';
import { ensureTasksGroupColumn } from './tasksSchema.repository.js';
import { getTaskById } from './tasksQuery.repository.js';

export async function updateTask(id, data = {}) {
  await ensureTasksGroupColumn();

  const current = await getTaskById(id);
  if (!current) return null;

  const updated = {
    title: data.title ?? current.title,
    description: data.description ?? current.description,
    status: data.status ?? current.status,
    assigned_to: data.assigned_to ?? current.assigned_to,
    created_by: data.created_by ?? current.created_by,
    priority: data.priority ?? current.priority,
    started_at: data.started_at ?? current.started_at,
    finished_at: data.finished_at ?? current.finished_at,
    duration_ms: data.duration_ms ?? current.duration_ms,
    observations: data.observations ?? current.observations,
    active: data.active === undefined ? current.active : toBool(data.active, current.active),
    task_group_id:
      data.task_group_id !== undefined
        ? toIntOrNull(data.task_group_id)
        : data.taskGroupId !== undefined
          ? toIntOrNull(data.taskGroupId)
          : current.task_group_id,
  };

  const { rows } = await pool.query(
    `
    UPDATE ${TB_TASKS}
    SET
      title = $1,
      description = $2,
      status = $3,
      assigned_to = $4,
      created_by = $5,
      priority = $6,
      started_at = $7,
      finished_at = $8,
      duration_ms = $9,
      observations = $10,
      active = $11,
      task_group_id = $12
    WHERE id = $13
    RETURNING *
    `,
    [
      updated.title,
      toNull(updated.description),
      toNull(updated.status),
      toNull(updated.assigned_to),
      toNull(updated.created_by),
      toNull(updated.priority),
      toNull(updated.started_at),
      toNull(updated.finished_at),
      toNull(updated.duration_ms),
      toNull(updated.observations),
      updated.active,
      toIntOrNull(updated.task_group_id),
      id,
    ]
  );

  return rows[0];
}

export async function finishTask(id) {
  await ensureTasksGroupColumn();

  const { rows } = await pool.query(
    `
    UPDATE ${TB_TASKS}
    SET
      status = 'FINISHED',
      finished_at = CURRENT_TIMESTAMP,
      duration_ms = CASE
        WHEN started_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) * 1000
        ELSE duration_ms
      END
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return rows[0] || null;
}

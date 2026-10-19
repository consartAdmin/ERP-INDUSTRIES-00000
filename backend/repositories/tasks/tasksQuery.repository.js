// ╔════════════════════════════════════════════════════════════════════╗
// ║ tasksQuery.repository.js — listTasks / getTaskById                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_TASKS, TB_TASK_GROUPS } from './tasks.constants.js';
import { toBool, toIntOrNull } from './tasks.sanitizers.js';
import { ensureTasksGroupColumn } from './tasksSchema.repository.js';

export async function listTasks({
  q = '',
  status = '',
  active = '',
  task_group_id = '',
  taskGroupId = '',
} = {}) {
  await ensureTasksGroupColumn();

  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    where.push(`
      (
        t.title ILIKE $${params.length}
        OR t.description ILIKE $${params.length}
        OR t.observations ILIKE $${params.length}
      )
    `);
  }

  if (status) {
    params.push(status);
    where.push(`t.status = $${params.length}`);
  }

  if (active !== '') {
    params.push(toBool(active, true));
    where.push(`t.active = $${params.length}`);
  }

  const groupId = toIntOrNull(task_group_id || taskGroupId);

  if (groupId !== null) {
    params.push(groupId);
    where.push(`t.task_group_id = $${params.length}`);
  }

  const sql = `
    SELECT
      t.*,

      tg.name AS task_group_name,
      tg.color AS task_group_color,
      tg.icon AS task_group_icon,
      tg.sort_order AS task_group_sort_order,
      tg.is_active AS task_group_is_active

    FROM ${TB_TASKS} t

    LEFT JOIN ${TB_TASK_GROUPS} tg
      ON tg.task_group_id = t.task_group_id

    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}

    ORDER BY
      t.created_at DESC,
      t.id DESC
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function getTaskById(id) {
  await ensureTasksGroupColumn();

  const { rows } = await pool.query(
    `
    SELECT
      t.*,

      tg.name AS task_group_name,
      tg.color AS task_group_color,
      tg.icon AS task_group_icon,
      tg.sort_order AS task_group_sort_order,
      tg.is_active AS task_group_is_active

    FROM ${TB_TASKS} t

    LEFT JOIN ${TB_TASK_GROUPS} tg
      ON tg.task_group_id = t.task_group_id

    WHERE t.id = $1
    `,
    [id]
  );

  return rows[0] || null;
}

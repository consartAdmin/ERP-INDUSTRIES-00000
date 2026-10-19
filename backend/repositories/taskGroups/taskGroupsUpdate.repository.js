// ╔════════════════════════════════════════════════════════════════════╗
// ║ taskGroupsUpdate.repository.js — update                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './taskGroups.constants.js';
import { toStrOrNull, toBool } from './taskGroups.sanitizers.js';
import { ensureTable } from './taskGroupsSchema.repository.js';
import { getById } from './taskGroupsQuery.repository.js';

export async function update(id, payload = {}) {
  await ensureTable();

  const current = await getById(id);
  if (!current) {
    const err = new Error('Grupo de tarefa não encontrado.');
    err.status = 404;
    throw err;
  }

  const name = toStrOrNull(payload.name);
  if (!name) {
    const err = new Error('Nome do grupo é obrigatório.');
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    `
    UPDATE ${TB}
    SET
      name = $2,
      color = $3,
      icon = $4,
      sort_order = $5,
      is_active = COALESCE($6, is_active),
      updated_at = NOW()
    WHERE task_group_id = $1
    RETURNING *
    `,
    [
      id,
      name,
      toStrOrNull(payload.color),
      toStrOrNull(payload.icon),
      Number(payload.sort_order || payload.sortOrder || 0),
      toBool(payload.is_active ?? payload.isActive),
    ]
  );

  return rows[0];
}

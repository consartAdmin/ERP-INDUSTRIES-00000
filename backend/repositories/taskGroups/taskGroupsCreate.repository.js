// ╔════════════════════════════════════════════════════════════════════╗
// ║ taskGroupsCreate.repository.js — create                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './taskGroups.constants.js';
import { toStrOrNull, toBool } from './taskGroups.sanitizers.js';
import { ensureTable } from './taskGroupsSchema.repository.js';

export async function create(payload = {}) {
  await ensureTable();

  const name = toStrOrNull(payload.name);
  if (!name) {
    const err = new Error('Nome do grupo é obrigatório.');
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    `
    INSERT INTO ${TB} (
      name,
      color,
      icon,
      sort_order,
      is_active,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), NOW(), NOW())
    RETURNING *
    `,
    [
      name,
      toStrOrNull(payload.color),
      toStrOrNull(payload.icon),
      Number(payload.sort_order || payload.sortOrder || 0),
      toBool(payload.is_active ?? payload.isActive),
    ]
  );

  return rows[0];
}

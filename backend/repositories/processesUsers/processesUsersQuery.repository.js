// ╔════════════════════════════════════════════════════════════════════╗
// ║ processesUsersQuery.repository.js — list / getById                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './processesUsers.constants.js';
import { ensureTable } from './processesUsersSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   list() — Filtro por process_id/user_id + paginação
────────────────────────────────────────────────────────────── */
export async function list({
  process_id = null,
  user_id = null,
  limit = 50,
  offset = 0
} = {}) {
  await ensureTable();
  // limit/offset entram no SQL por interpolação: força inteiros para evitar SQL injection
  limit = Math.max(Number.parseInt(limit, 10) || 50, 1);
  offset = Math.max(Number.parseInt(offset, 10) || 0, 0);

  const params = [];
  const whereParts = ['deleted_at IS NULL'];

  if (process_id != null && process_id !== '') {
    params.push(Number(process_id));
    whereParts.push(`process_id = $${params.length}`);
  }

  if (user_id != null && user_id !== '') {
    params.push(Number(user_id));
    whereParts.push(`user_id = $${params.length}`);
  }

  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM ${TB} ${where}`,
    params
  );
  const total = countRes.rows?.[0]?.total || 0;

  const { rows } = await pool.query(
    `
      SELECT *
      FROM ${TB}
      ${where}
      ORDER BY updated_at DESC, id DESC
      LIMIT ${limit} OFFSET ${offset};
    `,
    params
  );

  return { rows, total, limit, offset };
}

/* ──────────────────────────────────────────────────────────────
   getById() — Busca por ID
────────────────────────────────────────────────────────────── */
export async function getById(id) {
  await ensureTable();
  const { rows } = await pool.query(
    `SELECT * FROM ${TB} WHERE id = $1 LIMIT 1;`,
    [Number(id)]
  );
  return rows[0] || null;
}

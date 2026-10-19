// ╔════════════════════════════════════════════════════════════════════╗
// ║ processesQuery.repository.js — list / getById                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './processes.constants.js';
import { ensureTable } from './processesSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   list() — Listagem com filtro e paginação
────────────────────────────────────────────────────────────── */
export async function list({ q = '', status = '', limit = 20, offset = 0 } = {}) {
  await ensureTable();
  // limit/offset entram no SQL por interpolação: força inteiros para evitar SQL injection
  limit = Math.max(Number.parseInt(limit, 10) || 20, 1);
  offset = Math.max(Number.parseInt(offset, 10) || 0, 0);

  const params = [];
  const whereParts = [];

  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    const p = `$${params.length}`;
    whereParts.push(
      `(LOWER(codigo) LIKE ${p} OR LOWER(nome) LIKE ${p} OR LOWER(COALESCE(descricao, '')) LIKE ${p})`
    );
  }

  if (status) {
    params.push(status.toLowerCase());
    const p = `$${params.length}`;
    whereParts.push(`LOWER(status) = ${p}`);
  }

  // Por padrão não exibir deletados logicamente
  whereParts.push('deleted_at IS NULL');

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

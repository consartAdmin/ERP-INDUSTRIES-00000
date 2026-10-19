// ╔══════════════════════════════════════════════════════════════════════╗
// ║ employeesQuery.repository.js — list / getById                        ║
// ║ Tabela: public.employees                                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, PK } from './employees.constants.js';
import { ensureTable } from './employeesSchema.repository.js';

// ─────────────────────────────────────────────────────────────
// Employees CRUD
// ─────────────────────────────────────────────────────────────
export async function list({ q = '', active = true, limit = 50, offset = 0 } = {}) {
  await ensureTable();

  const params = [];
  let where = 'WHERE 1=1';

  if (active !== undefined && active !== null && active !== '') {
    params.push(!!active);
    where += ` AND active = $${params.length}`;
  }

  if (q) {
    params.push(`%${String(q).toLowerCase()}%`);
    const p = `$${params.length}`;
    where += ` AND (
      LOWER(full_name) LIKE ${p}
      OR LOWER(cpf) LIKE ${p}
      OR LOWER(COALESCE(email,'')) LIKE ${p}
      OR LOWER(COALESCE(phone,'')) LIKE ${p}
      OR LOWER(COALESCE(mobile,'')) LIKE ${p}
      OR LOWER(COALESCE(city,'')) LIKE ${p}
      OR LOWER(COALESCE(department,'')) LIKE ${p}
      OR LOWER(COALESCE(position,'')) LIKE ${p}
    )`;
  }

  const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM ${TB} ${where}`, params);
  const total = countRes.rows?.[0]?.total || 0;

  const { rows } = await pool.query(
    `
      SELECT *
      FROM ${TB}
      ${where}
      ORDER BY created_at DESC, ${PK} DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `,
    params
  );

  return { rows, total, limit: Number(limit), offset: Number(offset) };
}

export async function getById(id) {
  await ensureTable();
  const { rows } = await pool.query(`SELECT * FROM ${TB} WHERE ${PK} = $1 LIMIT 1;`, [Number(id)]);
  return rows[0] || null;
}

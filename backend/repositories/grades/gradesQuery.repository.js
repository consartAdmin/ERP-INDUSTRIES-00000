// ╔════════════════════════════════════════════════════════════════════╗
// ║ gradesQuery.repository.js — list / getById                         ║
// ║ Tabela: public."grades"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TFULL } from './grades.constants.js';
import { clampInt } from './grades.sanitizers.js';
import { ensureTable } from './gradesSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   list() — Listagem com filtro e paginação
────────────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────
   list() — Listagem com busca, status e paginação
────────────────────────────────────────────────────────────── */
export async function list({
  q = '',
  isActive,
  limit = 50,
  offset = 0,
} = {}) {
  await ensureTable();

  const safeQuery = String(q || '').trim();
  const safeLimit = clampInt(limit, { min: 1, max: 100 });
  const safeOffset = clampInt(offset, {
    min: 0,
    max: 2_000_000_000,
  });

  const values = [];
  const conditions = [];

  // Busca pelo nome ou pela descrição.
  if (safeQuery) {
    values.push(`%${safeQuery}%`);
    const position = values.length;

    conditions.push(`
      (
        gr.grade ILIKE $${position}
        OR COALESCE(gr.description, '') ILIKE $${position}
      )
    `);
  }

  // Filtra pelo status somente quando true ou false foi informado.
  if (typeof isActive === 'boolean') {
    values.push(isActive);
    conditions.push(`gr.is_active = $${values.length}`);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM ${TFULL} AS gr
    ${where};
  `;

  const listValues = [...values, safeLimit, safeOffset];
  const limitPosition = values.length + 1;
  const offsetPosition = values.length + 2;

  const rowsSql = `
    SELECT
      gr.grade_id,
      gr.grade,
      gr.description,
      gr.is_active,
      gr.created_at,
      gr.updated_at
    FROM ${TFULL} AS gr
    ${where}
    ORDER BY gr.grade ASC
    LIMIT $${limitPosition}
    OFFSET $${offsetPosition};
  `;

  const [countResult, rowsResult] = await Promise.all([
    pool.query(countSql, values),
    pool.query(rowsSql, listValues),
  ]);

  return {
    rows: rowsResult.rows,
    total: Number(countResult.rows[0]?.total || 0),
    limit: safeLimit,
    offset: safeOffset,
  };
}

/* ──────────────────────────────────────────────────────────────
   getById() — Busca por ID
────────────────────────────────────────────────────────────── */
export async function getById(id) {
  await ensureTable();
  const gradeId = clampInt(id, { min: 1, max: 2_000_000_000 });
  const { rows } = await pool.query(
    `SELECT * FROM ${TFULL} WHERE grade_id = $1 LIMIT 1;`,
    [gradeId]
  );
  return rows[0] || null;
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersQuery.repository.js — list / search / getById                 ║
// ║ Tabela: public.users                                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS, PK, SORT_COLS } from './users.constants.js';
import { SELECT_COLS, buildWhereAndParams } from './users.sql.js';
import { toNum } from './users.sanitizers.js';
import { mapRow } from './users.mappers.js';

/* ───────────────────────────── API ───────────────────────────── */

/**
 * Lista usuários com paginação, ordenação e filtros.
 *
 * @param {Object} opts
 * @param {number} opts.page  - página (1-based)
 * @param {number} opts.limit - registros por página
 * @param {string} opts.sort  - coluna de ordenação (user_id, name, email, access_level, created_at, is_active)
 * @param {string} opts.dir   - direção (asc|desc)
 * @param {string} opts.q     - busca textual em name/email
 * @param {boolean} opts.is_active - filtra por ativo/inativo
 * @param {string} opts.access_level - filtra por nível de acesso
 */
export async function list({
  page = 1,
  limit = 20,
  sort = PK,
  dir = 'asc',
  q = '',
  is_active,
  access_level,
} = {}) {
  const _page = Math.max(1, Number(page) || 1);
  const _limit = Math.min(200, Math.max(1, Number(limit) || 20));
  const offset = (_page - 1) * _limit;

  const _sort = SORT_COLS.has(String(sort)) ? String(sort) : PK;
  const _dir = String(dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const { clause, params } = buildWhereAndParams({ q, is_active, access_level });

  try {
    const { rows } = await pool.query(
      `
      SELECT
        ${SELECT_COLS}
      FROM ${TB} ${ALIAS}
      ${clause}
      ORDER BY ${ALIAS}.${_sort} ${_dir}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, _limit, offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM ${TB} ${ALIAS} ${clause}`,
      params
    );

    const mapped = rows.map(mapRow);

    return {
      ok: true,
      data: {
        rows: mapped,
        total: countRes.rows[0]?.total ?? 0,
        page: _page,
        limit: _limit,
      },
    };
  } catch (err) {
    console.error('[usersApi:list] error:', err);
    return { ok: false, error: 'Failed to list users.' };
  }
}

/** Atalho para busca: delega para list() com q */
export async function search(q, { page = 1, limit = 20, is_active, access_level } = {}) {
  return list({ page, limit, q, is_active, access_level });
}

/** Busca usuário por ID (user_id) */
export async function getById(id) {
  const uid = toNum(id);
  if (!uid) return { ok: false, error: 'user_id is required.' };

  try {
    const { rows } = await pool.query(
      `
      SELECT
        ${SELECT_COLS}
      FROM ${TB} ${ALIAS}
      WHERE ${ALIAS}.${PK} = $1
      `,
      [uid]
    );

    if (!rows.length) return { ok: false, error: 'User not found.' };
    return { ok: true, data: mapRow(rows[0]) };
  } catch (err) {
    console.error('[usersApi:getById] error:', err);
    return { ok: false, error: 'Failed to get user.' };
  }
}

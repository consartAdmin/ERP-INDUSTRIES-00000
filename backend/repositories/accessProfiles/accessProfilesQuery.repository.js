// ╔════════════════════════════════════════════════════════════════════╗
// ║ accessProfilesQuery.repository.js — list / getById / catálogo      ║
// ║ Tabela: public."accessProfiles"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ALIAS, TB } from './accessProfiles.constants.js';
import { mapRow } from './accessProfiles.mappers.js';
import { toNum } from './accessProfiles.sanitizers.js';

const SELECT_COLS = `
  ${ALIAS}.id, ${ALIAS}.code, ${ALIAS}.name, ${ALIAS}.description,
  ${ALIAS}.can_view, ${ALIAS}.can_create, ${ALIAS}.can_edit,
  ${ALIAS}.can_delete, ${ALIAS}.can_export,
  ${ALIAS}.is_custom, ${ALIAS}.is_system, ${ALIAS}.is_active,
  ${ALIAS}.sort_order, ${ALIAS}.created_at, ${ALIAS}.updated_at
`;

/** Quantos usuários distintos usam o perfil em algum módulo */
const USERS_COUNT = `
  (
    SELECT COUNT(DISTINCT up.usuario_id)
    FROM public."usersProfile" up
    WHERE up.profile = ${ALIAS}.code
  ) AS users_count
`;

/**
 * Lista perfis.
 * @param {Object} opts
 * @param {boolean} opts.onlyActive - só perfis ativos
 * @param {string}  opts.search     - busca em nome/código/descrição
 * @param {boolean} opts.withUsage  - inclui users_count
 */
export async function list({ onlyActive = false, search = '', withUsage = false } = {}) {
  const where = [];
  const params = [];

  if (onlyActive) where.push(`${ALIAS}.is_active = TRUE`);

  if (search) {
    params.push(`%${String(search).trim()}%`);
    where.push(`(
      ${ALIAS}.name ILIKE $${params.length}
      OR ${ALIAS}.code ILIKE $${params.length}
      OR ${ALIAS}.description ILIKE $${params.length}
    )`);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `
      SELECT ${SELECT_COLS}${withUsage ? `, ${USERS_COUNT}` : ''}
      FROM ${TB} ${ALIAS}
      ${clause}
      ORDER BY ${ALIAS}.sort_order ASC, ${ALIAS}.name ASC
      `,
      params
    );

    return { ok: true, data: rows.map(mapRow) };
  } catch (err) {
    console.error('[accessProfiles:list] error:', err);
    return { ok: false, error: 'Failed to list access profiles.' };
  }
}

export async function getById(id) {
  const pid = toNum(id);
  if (!pid) return { ok: false, error: 'id is required.' };

  try {
    const { rows } = await pool.query(
      `
      SELECT ${SELECT_COLS}, ${USERS_COUNT}
      FROM ${TB} ${ALIAS}
      WHERE ${ALIAS}.id = $1
      `,
      [pid]
    );

    if (!rows.length) return { ok: false, error: 'AccessProfile not found.' };
    return { ok: true, data: mapRow(rows[0]) };
  } catch (err) {
    console.error('[accessProfiles:getById] error:', err);
    return { ok: false, error: 'Failed to get access profile.' };
  }
}

/** Mapa code → perfil (todos, ativos e inativos). Usado pelo usersProfile. */
export async function getCatalogMap(db = pool) {
  const { rows } = await db.query(
    `SELECT ${SELECT_COLS} FROM ${TB} ${ALIAS}`
  );
  return new Map(rows.map((r) => [r.code, mapRow(r)]));
}

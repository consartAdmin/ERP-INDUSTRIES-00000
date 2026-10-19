// ╔════════════════════════════════════════════════════════════════════╗
// ║ userModulesQuery.repository.js — list / getById /                  ║
// ║ listModulesForUser (JOIN com "moduleSystem")                       ║
// ║ Tabela: public."userModules"                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS } from './userModules.constants.js';
import { toNum } from './userModules.sanitizers.js';
import { mapRow } from './userModules.mappers.js';
import { buildWhereAndParams } from './userModules.sql.js';

/**
 * Lista vínculos usuário/módulo com paginação, ordenação e filtros.
 *
 * @param {Object} opts
 * @param {number} opts.page         - página (1-based)
 * @param {number} opts.limit        - registros por página
 * @param {string} opts.sort         - coluna: id, usuario_id, modulo_id, pode_acessar, created_at, updated_at
 * @param {string} opts.dir          - direção (asc|desc)
 * @param {number} opts.usuario_id   - filtra por usuário
 * @param {number} opts.modulo_id    - filtra por módulo
 * @param {boolean} opts.pode_acessar - filtra por permissão (true/false)
 */
export async function list({
  page = 1,
  limit = 20,
  sort = 'id',
  dir = 'asc',
  usuario_id,
  modulo_id,
  pode_acessar,
} = {}) {
  const _page = Math.max(1, Number(page) || 1);
  const _limit = Math.min(200, Math.max(1, Number(limit) || 20));
  const offset = (_page - 1) * _limit;

  const sortCols = new Set([
    'id',
    'usuario_id',
    'modulo_id',
    'pode_acessar',
    'created_at',
    'updated_at',
  ]);

  const _sort = sortCols.has(String(sort)) ? String(sort) : 'id';
  const _dir = String(dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const { clause, params } = buildWhereAndParams({
    usuario_id,
    modulo_id,
    pode_acessar,
  });

  try {
    const { rows } = await pool.query(
      `
      SELECT
        ${ALIAS}.id,
        ${ALIAS}.usuario_id,
        ${ALIAS}.modulo_id,
        ${ALIAS}.pode_acessar,
        ${ALIAS}.created_at,
        ${ALIAS}.updated_at
      FROM ${TB} ${ALIAS}
      ${clause}
      ORDER BY ${ALIAS}.${_sort} ${_dir}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, _limit, offset]
    );

    const countRes = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM ${TB} ${ALIAS}
      ${clause}
      `,
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
    console.error('[userModulesApi:list] error:', err);
    return { ok: false, error: 'Failed to list user modules.' };
  }
}

/** Busca vínculo por ID */
export async function getById(id) {
  const uid = toNum(id);
  if (!uid) return { ok: false, error: 'id is required.' };

  try {
    const { rows } = await pool.query(
      `
      SELECT
        ${ALIAS}.id,
        ${ALIAS}.usuario_id,
        ${ALIAS}.modulo_id,
        ${ALIAS}.pode_acessar,
        ${ALIAS}.created_at,
        ${ALIAS}.updated_at
      FROM ${TB} ${ALIAS}
      WHERE ${ALIAS}.id = $1
      `,
      [uid]
    );

    if (!rows.length) return { ok: false, error: 'UserModule not found.' };
    return { ok: true, data: mapRow(rows[0]) };
  } catch (err) {
    console.error('[userModulesApi:getById] error:', err);
    return { ok: false, error: 'Failed to get user module.' };
  }
}

/* ─────────── JOIN com moduleSystem: módulos por usuário ─────────── */

/**
 * Retorna a lista de módulos (da "moduleSystem") que o usuário pode acessar.
 * - Faz JOIN userModules ⇔ moduleSystem
 * - Considera pode_acessar = true
 * - Considera moduleSystem.is_active = true
 *
 * @param {number} usuarioId
 * @returns {Promise<{ok:boolean, data?:Array, error?:string}>}
 */
export async function listModulesForUser(usuarioId) {
  const uid = toNum(usuarioId);
  if (!uid) return { ok: false, error: 'usuarioId inválido.' };

  try {
    const { rows } = await pool.query(
      `
      SELECT
        m.id         AS module_id,
        um.id        AS user_module_id,
        um.usuario_id,
        um.modulo_id,
        um.pode_acessar,
        m.name,
        m.path,
        m.is_active
      FROM public."userModules" um
      JOIN public."moduleSystem" m
        ON m.id = um.modulo_id
      WHERE um.usuario_id   = $1
        AND um.pode_acessar = TRUE
        AND m.is_active     = TRUE
      ORDER BY m.id
      `,
      [uid]
    );

    return { ok: true, data: rows };
  } catch (err) {
    console.error('[userModulesApi:listModulesForUser] error:', err);
    return { ok: false, error: 'Failed to list modules for user.' };
  }
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersProfileQuery.repository.js — listByUser / getByUserAndModule  ║
// ║ / summary (JOIN com "moduleSystem")                                ║
// ║ Tabela: public."usersProfile"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS } from './usersProfile.constants.js';
import { toNum } from './usersProfile.sanitizers.js';
import { mapModuleRow } from './usersProfile.mappers.js';

/**
 * Lista TODOS os módulos cadastrados em "moduleSystem" com o perfil
 * do usuário em cada um (LEFT JOIN). Módulos sem registro vêm como SEM_ACESSO.
 *
 * @param {number} usuarioId
 * @param {Object} opts
 * @param {boolean} opts.onlyActive - considera apenas módulos ativos (default true)
 */
export async function listByUser(usuarioId, { onlyActive = true } = {}) {
  const uid = toNum(usuarioId);
  if (!uid) return { ok: false, error: 'usuario_id inválido.' };

  try {
    const { rows } = await pool.query(
      `
      SELECT
        m.id          AS modulo_id,
        m.name        AS module_name,
        m.path        AS module_path,
        m.is_active   AS module_is_active,
        ${ALIAS}.id   AS profile_id,
        ${ALIAS}.profile,
        ${ALIAS}.can_view,
        ${ALIAS}.can_create,
        ${ALIAS}.can_edit,
        ${ALIAS}.can_delete,
        ${ALIAS}.can_export,
        ${ALIAS}.updated_at
      FROM public."moduleSystem" m
      LEFT JOIN ${TB} ${ALIAS}
        ON ${ALIAS}.modulo_id  = m.id
       AND ${ALIAS}.usuario_id = $1
      WHERE ($2::boolean = FALSE OR m.is_active = TRUE)
      ORDER BY m.name ASC, m.id ASC
      `,
      [uid, Boolean(onlyActive)]
    );

    return { ok: true, data: rows.map(mapModuleRow) };
  } catch (err) {
    console.error('[usersProfile:listByUser] error:', err);
    return { ok: false, error: 'Failed to list user profiles.' };
  }
}

/** Perfil de um usuário em um módulo (SEM_ACESSO se não houver registro) */
export async function getByUserAndModule(usuarioId, moduloId) {
  const uid = toNum(usuarioId);
  const mid = toNum(moduloId);
  if (!uid || !mid) return { ok: false, error: 'usuario_id e modulo_id são obrigatórios.' };

  try {
    const { rows } = await pool.query(
      `
      SELECT
        m.id          AS modulo_id,
        m.name        AS module_name,
        m.path        AS module_path,
        m.is_active   AS module_is_active,
        ${ALIAS}.id   AS profile_id,
        ${ALIAS}.profile,
        ${ALIAS}.can_view,
        ${ALIAS}.can_create,
        ${ALIAS}.can_edit,
        ${ALIAS}.can_delete,
        ${ALIAS}.can_export,
        ${ALIAS}.updated_at
      FROM public."moduleSystem" m
      LEFT JOIN ${TB} ${ALIAS}
        ON ${ALIAS}.modulo_id  = m.id
       AND ${ALIAS}.usuario_id = $1
      WHERE m.id = $2
      `,
      [uid, mid]
    );

    if (!rows.length) return { ok: false, error: 'Module not found.' };
    return { ok: true, data: mapModuleRow(rows[0]) };
  } catch (err) {
    console.error('[usersProfile:getByUserAndModule] error:', err);
    return { ok: false, error: 'Failed to get user profile.' };
  }
}

/**
 * Resumo por usuário: quantos módulos ele acessa e quais perfis usa.
 * Usado na listagem principal da tela.
 */
export async function summary() {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        ${ALIAS}.usuario_id,
        COUNT(*) FILTER (WHERE ${ALIAS}.can_view)::int AS modules_with_access,
        COUNT(*) FILTER (WHERE ${ALIAS}.profile = 'ADMINISTRADOR')::int AS modules_as_admin,
        MAX(${ALIAS}.updated_at) AS last_update
      FROM ${TB} ${ALIAS}
      JOIN public."moduleSystem" m
        ON m.id = ${ALIAS}.modulo_id
       AND m.is_active = TRUE
      GROUP BY ${ALIAS}.usuario_id
      `
    );

    return { ok: true, data: rows };
  } catch (err) {
    console.error('[usersProfile:summary] error:', err);
    return { ok: false, error: 'Failed to summarize user profiles.' };
  }
}

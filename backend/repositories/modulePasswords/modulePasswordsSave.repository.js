// ╔════════════════════════════════════════════════════════════════════╗
// ║ modulePasswordsSave.repository.js — create / update / remove       ║
// ║ Tabela: public."modulePasswords"                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import bcrypt from 'bcryptjs';
import pool from '../../config/db.js';
import { TB, BCRYPT_ROUNDS } from './modulePasswords.constants.js';
import { mapRow } from './modulePasswords.mappers.js';
import {
  requireCode,
  requirePassword,
  sanitizeDescription,
  toBool,
  toIdOrNull,
  validationError,
} from './modulePasswords.sanitizers.js';
import { ready } from './modulePasswordsSchema.repository.js';

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** CREATE — senha opcional */
export async function create(payload = {}, userId = null) {
  const moduleCode = requireCode(payload.module_code, 'Módulo');
  const actionCode = requireCode(payload.action_code, 'Ação');
  const hasPassword = String(payload.password ?? '') !== '';
  const passwordHash = hasPassword
    ? await hashPassword(requirePassword(payload.password))
    : null;

  await ready();

  try {
    const { rows } = await pool.query(
      `INSERT INTO ${TB}
         (module_code, action_code, description, password_hash, is_active, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        moduleCode,
        actionCode,
        sanitizeDescription(payload.description),
        passwordHash,
        toBool(payload.is_active, true),
        userId,
      ]
    );
    return mapRow(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      throw validationError(`Já existe uma senha para ${moduleCode} / ${actionCode}.`);
    }
    throw err;
  }
}

/** UPDATE — descrição, ativo e (opcional) nova senha */
export async function updateById(id, payload = {}, userId = null) {
  const sid = toIdOrNull(id);
  if (!sid) throw validationError('ID inválido.');

  const sets = [];
  const params = [];
  const push = (column, value) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (payload.description !== undefined) {
    push('description', sanitizeDescription(payload.description));
  }
  if (payload.is_active !== undefined) {
    push('is_active', toBool(payload.is_active, true));
  }
  if (String(payload.password ?? '') !== '') {
    push('password_hash', await hashPassword(requirePassword(payload.password)));
  }

  await ready();

  push('updated_by', userId);
  sets.push('updated_at = NOW()');
  params.push(sid);

  const { rows } = await pool.query(
    `UPDATE ${TB}
        SET ${sets.join(', ')}
      WHERE module_password_id = $${params.length}
      RETURNING *`,
    params
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** REMOVE PASSWORD — volta a usar o fallback (.env) */
export async function clearPassword(id, userId = null) {
  const sid = toIdOrNull(id);
  if (!sid) throw validationError('ID inválido.');

  await ready();
  const { rows } = await pool.query(
    `UPDATE ${TB}
        SET password_hash = NULL, updated_by = $1, updated_at = NOW()
      WHERE module_password_id = $2
      RETURNING *`,
    [userId, sid]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** DELETE */
export async function removeById(id) {
  const sid = toIdOrNull(id);
  if (!sid) throw validationError('ID inválido.');

  await ready();
  const { rowCount } = await pool.query(
    `DELETE FROM ${TB} WHERE module_password_id = $1`,
    [sid]
  );
  return { ok: rowCount > 0 };
}

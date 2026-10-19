// ╔══════════════════════════════════════════════════════════════════════╗
// ║ pdv_loginsUpdate.repository.js — update / setActive                  ║
// ║ Tabela: public.pdv_logins                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import bcrypt from 'bcryptjs';
import pool from '../../config/db.js';
import { TABLE, BCRYPT_ROUNDS, SAFE_COLUMNS } from './pdv_logins.constants.js';
import {
  normalizeUsername,
  normalizeFullName,
  normalizeRole,
  normalizeBoolean,
  validatePassword,
  validateIdentity,
} from './pdv_logins.sanitizers.js';

export async function update(id, payload = {}) {
  const currentResult = await pool.query(
    `SELECT id, username, full_name, role, active FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  const current = currentResult.rows[0];
  if (!current) return null;

  const username = payload.username === undefined
    ? current.username
    : normalizeUsername(payload.username);
  const fullName = payload.full_name === undefined
    ? current.full_name
    : normalizeFullName(payload.full_name);
  validateIdentity(username, fullName);

  const role = payload.role === undefined ? current.role : normalizeRole(payload.role);
  const active = payload.active === undefined ? current.active : normalizeBoolean(payload.active);
  const password = validatePassword(payload.password, false);

  if (password) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await pool.query(
      `UPDATE ${TABLE}
          SET username = $2,
              full_name = $3,
              role = $4,
              active = $5,
              password_hash = $6,
              updated_at = NOW()
        WHERE id = $1
        RETURNING ${SAFE_COLUMNS}`,
      [id, username, fullName, role, active, passwordHash]
    );
    return result.rows[0] ?? null;
  }

  const result = await pool.query(
    `UPDATE ${TABLE}
        SET username = $2,
            full_name = $3,
            role = $4,
            active = $5,
            updated_at = NOW()
      WHERE id = $1
      RETURNING ${SAFE_COLUMNS}`,
    [id, username, fullName, role, active]
  );
  return result.rows[0] ?? null;
}

export async function setActive(id, active) {
  const result = await pool.query(
    `UPDATE ${TABLE}
        SET active = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING ${SAFE_COLUMNS}`,
    [id, normalizeBoolean(active)]
  );
  return result.rows[0] ?? null;
}

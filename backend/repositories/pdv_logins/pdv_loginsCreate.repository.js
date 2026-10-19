// ╔══════════════════════════════════════════════════════════════════════╗
// ║ pdv_loginsCreate.repository.js — create                              ║
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

export async function create({ username, full_name, password, role, active } = {}) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedFullName = normalizeFullName(full_name);
  validateIdentity(normalizedUsername, normalizedFullName);
  const validPassword = validatePassword(password);
  const passwordHash = await bcrypt.hash(validPassword, BCRYPT_ROUNDS);

  const result = await pool.query(
    `INSERT INTO ${TABLE}
       (username, full_name, password_hash, role, active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING ${SAFE_COLUMNS}`,
    [
      normalizedUsername,
      normalizedFullName,
      passwordHash,
      normalizeRole(role),
      normalizeBoolean(active, true),
    ]
  );

  return result.rows[0];
}

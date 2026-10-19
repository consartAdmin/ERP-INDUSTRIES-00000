// ╔══════════════════════════════════════════════════════════════════════╗
// ║ pdv_loginsAuth.repository.js — verifyCredentials (login PDV)         ║
// ║ Tabela: public.pdv_logins                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import bcrypt from 'bcryptjs';
import pool from '../../config/db.js';
import { TABLE } from './pdv_logins.constants.js';
import { normalizeUsername } from './pdv_logins.sanitizers.js';

export async function verifyCredentials(username, password) {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername || typeof password !== 'string' || !password) return null;

  const result = await pool.query(
    `SELECT id, username, full_name, password_hash, role, active, created_at, updated_at
       FROM ${TABLE}
      WHERE username = $1
      LIMIT 1`,
    [normalizedUsername]
  );

  const user = result.rows[0];
  if (!user || !user.active) return null;
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

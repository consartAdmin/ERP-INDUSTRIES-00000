// ╔════════════════════════════════════════════════════════════════════╗
// ║ modulePasswordsVerify.repository.js — confere a senha digitada     ║
// ║ Tabela: public."modulePasswords"                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import bcrypt from 'bcryptjs';
import pool from '../../config/db.js';
import { TB } from './modulePasswords.constants.js';
import { normalizeCode } from './modulePasswords.sanitizers.js';
import { ready } from './modulePasswordsSchema.repository.js';

async function findRow(moduleCode, actionCode) {
  await ready();

  const { rows } = await pool.query(
    `SELECT password_hash, is_active
       FROM ${TB}
      WHERE module_code = $1 AND action_code = $2`,
    [normalizeCode(moduleCode), normalizeCode(actionCode)]
  );
  return rows[0] || null;
}

/*
 * Regras:
 *  - linha inativa ou sem senha   → não exige senha
 *  - linha ativa com senha        → compara com o hash (bcrypt)
 *  - sem linha                    → usa `fallback` (ex.: valor do .env);
 *                                   fallback vazio → não exige senha
 */

/** @returns {Promise<boolean>} true quando a ação exige senha */
export async function isModulePasswordRequired(moduleCode, actionCode, { fallback = '' } = {}) {
  const row = await findRow(moduleCode, actionCode);
  if (row) return Boolean(row.is_active && row.password_hash);
  return Boolean(String(fallback ?? '').trim());
}

/** @returns {Promise<boolean>} true quando liberado */
export async function verifyModulePassword(moduleCode, actionCode, typed, { fallback = '' } = {}) {
  const row = await findRow(moduleCode, actionCode);
  const received = String(typed ?? '');

  if (row) {
    if (!row.is_active || !row.password_hash) return true;
    if (!received) return false;
    return bcrypt.compare(received, row.password_hash);
  }

  const expected = String(fallback ?? '').trim();
  if (!expected) return true;
  return received.trim() === expected;
}

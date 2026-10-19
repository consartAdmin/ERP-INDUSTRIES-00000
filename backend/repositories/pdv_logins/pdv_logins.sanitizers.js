// ╔══════════════════════════════════════════════════════════════════════╗
// ║ pdv_logins.sanitizers.js — Validação/normalização de entrada         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { DEFAULT_ROLE, ALLOWED_ROLES } from './pdv_logins.constants.js';

export function normalizeUsername(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeFullName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeRole(value) {
  const role = String(value ?? DEFAULT_ROLE).trim().toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    const error = new Error('Perfil inválido. Use operator, supervisor ou admin.');
    error.code = 'INVALID_ROLE';
    error.status = 400;
    throw error;
  }
  return role;
}

export function normalizeBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || String(value).toLowerCase() === 'true') return true;
  if (value === 0 || value === '0' || String(value).toLowerCase() === 'false') return false;
  const error = new Error('O campo active deve ser booleano.');
  error.code = 'INVALID_ACTIVE';
  error.status = 400;
  throw error;
}

export function validatePassword(password, required = true) {
  if (!required && (password === undefined || password === null || password === '')) return null;
  if (typeof password !== 'string' || password.length < 8) {
    const error = new Error('A senha deve possuir no mínimo 8 caracteres.');
    error.code = 'INVALID_PASSWORD';
    error.status = 400;
    throw error;
  }
  if (password.length > 72) {
    const error = new Error('A senha deve possuir no máximo 72 caracteres.');
    error.code = 'INVALID_PASSWORD';
    error.status = 400;
    throw error;
  }
  return password;
}

export function validateIdentity(username, fullName) {
  if (!username || username.length < 3 || username.length > 50) {
    const error = new Error('O usuário deve possuir entre 3 e 50 caracteres.');
    error.code = 'INVALID_USERNAME';
    error.status = 400;
    throw error;
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    const error = new Error('O usuário aceita apenas letras, números, ponto, hífen e sublinhado.');
    error.code = 'INVALID_USERNAME';
    error.status = 400;
    throw error;
  }
  if (!fullName || fullName.length > 120) {
    const error = new Error('O nome completo é obrigatório e deve possuir até 120 caracteres.');
    error.code = 'INVALID_FULL_NAME';
    error.status = 400;
    throw error;
  }
}

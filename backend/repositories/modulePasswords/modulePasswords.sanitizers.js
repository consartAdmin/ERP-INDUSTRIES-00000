// ╔════════════════════════════════════════════════════════════════════╗
// ║ modulePasswords.sanitizers.js — Normalização e validação           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { CODE_RE, PASSWORD_MIN_LENGTH } from './modulePasswords.constants.js';

export function toIdOrNull(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function normalizeCode(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

export function requireCode(value, label) {
  const code = normalizeCode(value);
  if (!CODE_RE.test(code)) {
    throw validationError(`${label} inválido. Use letras, números e "_" (2 a 60 caracteres).`);
  }
  return code;
}

export function sanitizeDescription(value) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, 255) : null;
}

export function toBool(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 't', 'yes', 'y', 'on', 'sim'].includes(String(value).toLowerCase());
}

export function requirePassword(value) {
  const password = String(value ?? '');
  if (password.trim().length < PASSWORD_MIN_LENGTH) {
    throw validationError(`A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }
  return password;
}

export function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

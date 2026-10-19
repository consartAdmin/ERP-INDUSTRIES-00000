// ╔════════════════════════════════════════════════════════════════════╗
// ║ chartOfAccounts.sanitizers.js — Erros HTTP e normalização          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { COLUMNS, INDEXES, CHECKS, FOREIGN_KEYS } from './chartOfAccounts.constants.js';

/* ─────────────────────────── Helpers ─────────────────────────── */

export function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Translates PostgreSQL constraint errors into the API's error codes, using the catalog */
export function mapDbError(err) {
  if (err?.code === '23505') {
    const idx = INDEXES.find((i) => i.name === err.constraint);
    if (idx) return httpError(`${idx.columns.join('_').toUpperCase()}_ALREADY_EXISTS`, 409);
  }
  if (err?.code === '23514') {
    const chk = CHECKS.find((c) => c.name === err.constraint);
    if (chk) return httpError(`INVALID_${chk.column.toUpperCase()}`, 400);
  }
  if (err?.code === '23503') {
    const fk = FOREIGN_KEYS.find((f) => f.constraint === err.constraint);
    if (fk) return httpError(`${fk.column.replace(/_id$/, '').toUpperCase()}_NOT_FOUND`, 404);
  }
  return err;
}

export function normalizePaging(page = 1, limit = 20) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 500);
  const offset = (safePage - 1) * safeLimit;
  return { safePage, safeLimit, offset };
}

export function normalizeBoolean(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const v = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(v)) return true;
  if (['false', '0', 'no', 'n'].includes(v)) return false;
  return fallback;
}

export function normalizeNullableText(value) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  return v || null;
}

/** Required text; enforces the varchar length from the catalog */
export function normalizeRequiredText(value, fieldName) {
  const v = String(value || '').trim();
  if (!v) throw httpError(`${fieldName.toUpperCase()}_REQUIRED`, 400);

  const maxLength = COLUMNS[fieldName]?.length;
  if (maxLength && v.length > maxLength) {
    throw httpError(`${fieldName.toUpperCase()}_TOO_LONG`, 400);
  }
  return v;
}

/** Uppercases and checks the value against the column's enum in the catalog */
export function normalizeEnum(value, column, errorCode) {
  const v = String(value || '').trim().toUpperCase();
  if (!COLUMNS[column].enum.includes(v)) throw httpError(errorCode, 400);
  return v;
}

export function normalizeType(value) {
  return normalizeEnum(value, 'account_type', 'INVALID_ACCOUNT_TYPE');
}

export function normalizeNature(value) {
  return normalizeEnum(value, 'nature', 'INVALID_NATURE');
}

/** Empty → fallback; otherwise must be an integer >= catalog min (chk_chartofaccounts_level) */
export function normalizeLevel(value, fallback = COLUMNS.level.default) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < COLUMNS.level.min) throw httpError('INVALID_LEVEL', 400);
  return n;
}

export function inferLevelFromCode(code) {
  const safe = String(code || '').trim();
  if (!safe) return 1;
  return safe.split('.').filter(Boolean).length || 1;
}

export function normalizeId(value, fieldName = 'id', { allowNull = false } = {}) {
  if (allowNull && (value === null || value === undefined || value === '')) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw httpError(`INVALID_${String(fieldName).toUpperCase()}`, 400);
  }
  return n;
}

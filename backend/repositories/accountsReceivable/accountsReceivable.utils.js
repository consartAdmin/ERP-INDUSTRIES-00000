// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivable.utils.js — Helpers puros                        ║
// ║ Diagnóstico de persistência, FS, datas, valores                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import fs from 'node:fs';
import { AR_DIAGNOSTIC_FIELDS, RECEIVED_STATUSES } from './accountsReceivable.constants.js';

export function persistenceDiagnostic(source = {}) {
  return Object.fromEntries(
    AR_DIAGNOSTIC_FIELDS.map((field) => [
      field,
      source[field] === undefined ? '[undefined]' : source[field],
    ])
  );
}

export function postgresErrorDiagnostic(error) {
  return {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    hint: error?.hint,
    constraint: error?.constraint,
    schema: error?.schema,
    table: error?.table,
    column: error?.column,
  };
}

export function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.warn('[AR] ensureDir falhou:', dir, e?.message || e);
  }
}

export function safeFilename(s) {
  return String(s || '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 180);
}

export function isReceivedStatus(status) {
  return RECEIVED_STATUSES.has(String(status || '').trim().toUpperCase());
}

export function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(str) ? str.slice(0, 10) : null;
}

export function cut(value, max) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str ? str.slice(0, max) : null;
}

export function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

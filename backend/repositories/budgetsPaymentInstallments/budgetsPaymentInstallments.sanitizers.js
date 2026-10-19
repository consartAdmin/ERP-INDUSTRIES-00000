// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentInstallments.sanitizers.js — normalizadores            ║
// ║ toInt / toNumber / round2 / status / notes / timestamp               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  DEFAULT_STATUS,
  INSTALLMENT_STATUSES,
} from './budgetsPaymentInstallments.constants.js';

/* ──────────────────────────────────────────────────────────────────────
 * Normalizadores
 * ──────────────────────────────────────────────────────────────────── */

export function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function round2(value) {
  return Number(toNumber(value, 0).toFixed(2));
}

export function normalizeStatus(status, fallback = DEFAULT_STATUS) {
  const value = String(status ?? '').trim().toUpperCase();
  if (!value) return fallback;

  if (!INSTALLMENT_STATUSES.includes(value)) {
    throw new Error(
      `status inválido: "${status}". Valores aceitos: ${INSTALLMENT_STATUSES.join(', ')}.`
    );
  }

  return value;
}

export function normalizeNotes(value) {
  return value != null ? String(value).trim() : null;
}

export function toTimestamp(value, column) {
  if (value == null || value === '') return null;

  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) {
    throw new Error(`${column} inválido: "${value}".`);
  }

  return dt;
}

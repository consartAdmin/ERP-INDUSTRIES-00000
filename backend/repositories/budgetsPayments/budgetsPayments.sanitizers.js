// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPayments.sanitizers.js — normalizadores                       ║
// ║ toInt / toNumber / round2 / normalizeText / normalizeIsoDate         ║
// ╚══════════════════════════════════════════════════════════════════════╝

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

export function normalizeText(value, fallback = null) {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s || fallback;
}

export function normalizeIsoDate(value, fallback = null) {
  if (value == null || value === '') return fallback;

  const s = String(value).trim();
  if (!s) return fallback;

  const matchBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (matchBr) {
    const [, dd, mm, yyyy] = matchBr;
    return `${yyyy}-${mm}-${dd}`;
  }

  const matchIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
  }

  return fallback;
}

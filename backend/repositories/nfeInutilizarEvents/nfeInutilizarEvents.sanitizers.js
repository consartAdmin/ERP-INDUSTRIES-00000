// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEvents.sanitizers.js — Normalização de entrada          ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* =======================================================================
 * Helpers
 * ======================================================================= */
export function normalizeDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function toInt(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function nowYear() {
  return new Date().getFullYear();
}

export function normalizeStatusValue(value) {
  return String(value ?? '').trim().toUpperCase();
}

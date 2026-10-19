// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalApuracao.sanitizers.js — Normalização de números/textos/datas ║
// ╚════════════════════════════════════════════════════════════════════╝

/* ======================================================================
   HELPERS
   ====================================================================== */

export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeText(value, fallback = null) {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
}

export function normalizeDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  return text || null;
}

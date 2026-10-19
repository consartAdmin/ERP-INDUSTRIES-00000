// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersPayments.sanitizers.js — Normalização de entrada             ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizeMoney(value, def = 0) {
  const n = Number(value ?? def);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : def;
}

export function normalizeInt(value, def = null) {
  if (value === undefined || value === null || value === '') return def;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

export function normalizeText(value, def = null) {
  if (value === undefined || value === null) return def;
  const s = String(value).trim();
  return s || def;
}

export function normalizeDate(value, def = null) {
  if (!value) return def;
  const s = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : def;
}

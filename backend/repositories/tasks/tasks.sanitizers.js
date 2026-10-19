// ╔════════════════════════════════════════════════════════════════════╗
// ║ tasks.sanitizers.js — Normalização de entrada                      ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toNull(value) {
  return value === undefined || value === '' ? null : value;
}

export function toBool(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  const s = String(value).trim().toLowerCase();

  if (['true', '1', 't', 'yes', 'y', 'sim', 's'].includes(s)) return true;
  if (['false', '0', 'f', 'no', 'n', 'nao', 'não'].includes(s)) return false;

  return fallback;
}

export function toIntOrNull(value) {
  if (value === undefined || value === null || value === '') return null;

  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

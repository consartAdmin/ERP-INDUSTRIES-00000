// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsStages.sanitizers.js — Normalização de entrada das etapas  ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return fallback;

  const v = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'y', 'on', 'sim'].includes(v)) return true;
  if (['false', '0', 'no', 'n', 'off', 'nao', 'não'].includes(v)) return false;

  return fallback;
}

export function normalizeInteger(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function normalizeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

export function buildCodeFromStageName(stageName = '') {
  return String(stageName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
}

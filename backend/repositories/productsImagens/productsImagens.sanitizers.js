// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsImagens.sanitizers.js — normalização de entrada            ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return fallback;

  const v = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on', 'sim'].includes(v)) return true;
  if (['false', '0', 'no', 'n', 'off', 'nao', 'não'].includes(v)) return false;

  return fallback;
}

export function normalizeNullableString(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

export function normalizeRequiredString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function normalizePositiveInt(value, fallback = 1) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function normalizeBarcodeId(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return normalizePositiveInt(value, null);
}

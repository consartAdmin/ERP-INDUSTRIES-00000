// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashDocumentTypes.sanitizers.js — Normalização de entrada          ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return fallback;
}

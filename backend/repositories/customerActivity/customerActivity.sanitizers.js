// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerActivity.sanitizers.js — Validação/normalização de entrada ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizePaging(page = 1, limit = 20) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 200);
  const offset = (safePage - 1) * safeLimit;
  return { safePage, safeLimit, offset };
}

export function normalizeStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return null;

  const allowed = new Set(['active', 'at_risk', 'inactive', 'lost']);
  return allowed.has(value) ? value : null;
}

export function normalizeFollowupType(type) {
  const value = String(type || '').trim().toLowerCase();
  if (!value) return null;

  const allowed = new Set(['whatsapp', 'call', 'email', 'training']);
  return allowed.has(value) ? value : null;
}

export function normalizeSourceModule(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export function toNullableInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmLossReasons.sanitizers.js — Validação/normalização de entrada   ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return fallback;

  const v = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'y', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(v)) return false;

  return fallback;
}

export function sanitizeText(value) {
  return String(value || '').trim();
}

export function normalizeId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid id.');
  }

  return id;
}

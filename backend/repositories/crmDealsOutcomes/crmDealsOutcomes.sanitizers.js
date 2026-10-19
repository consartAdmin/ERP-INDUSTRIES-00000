// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsOutcomes.sanitizers.js — Normalização e validação          ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return fallback;

  const v = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(v)) return false;

  return fallback;
}

export function normalizeInteger(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function normalizeText(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  const v = String(value).trim();
  return v ? v : fallback;
}

export function mapOutcomePayload(payload = {}) {
  return {
    name: normalizeText(payload.name, ''),
    icon: normalizeText(payload.icon, null),
    color: normalizeText(payload.color, '#7ED321'),
    sort_order: normalizeInteger(payload.sort_order, 0),
    is_active: normalizeBoolean(payload.is_active, true),
    code: normalizeText(payload.code, null),
    outcome_type: normalizeText(payload.outcome_type, null)
  };
}

export function validateOutcomePayload(data, { partial = false } = {}) {
  const errors = [];

  if (!partial || Object.prototype.hasOwnProperty.call(data, 'name')) {
    if (!normalizeText(data.name, '')) {
      errors.push('O campo "name" é obrigatório.');
    }
  }

  return errors;
}

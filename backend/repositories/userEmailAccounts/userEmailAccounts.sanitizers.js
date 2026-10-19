// ╔════════════════════════════════════════════════════════════════════╗
// ║ userEmailAccounts.sanitizers.js — Normalização / validação         ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toBool(v, def = false) {
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  return def;
}

export function toInt(v, def = 0) {
  const n = Number(v);
  return Number.isInteger(n) ? n : def;
}

export function toIntOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

export function normalizePayload(input = {}) {
  return {
    user_id: toIntOrNull(input.user_id),
    email_account_id: toIntOrNull(input.email_account_id),
    is_default: toBool(input.is_default, false),
    can_read: toBool(input.can_read, true),
    can_send: toBool(input.can_send, true),
  };
}

export function normalizePatch(input = {}) {
  const out = {};

  if ('user_id' in input) out.user_id = toIntOrNull(input.user_id);
  if ('email_account_id' in input) out.email_account_id = toIntOrNull(input.email_account_id);
  if ('is_default' in input) out.is_default = toBool(input.is_default, false);
  if ('can_read' in input) out.can_read = toBool(input.can_read, true);
  if ('can_send' in input) out.can_send = toBool(input.can_send, true);

  return out;
}

export function validateCreatePayload(payload) {
  const errors = [];

  if (!payload.user_id) errors.push('user_id is required');
  if (!payload.email_account_id) errors.push('email_account_id is required');

  return errors;
}

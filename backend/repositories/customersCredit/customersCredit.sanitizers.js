// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersCredit.sanitizers.js — Validação/normalização de entrada  ║
// ╚════════════════════════════════════════════════════════════════════╝

export const toCustomerId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error('invalid customer_id');
  return id;
};

export const toMoney = (value, field) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${field} must be a number greater than or equal to zero`);
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

export const toBool = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (['1', 'true', 't', 'yes', 'y'].includes(String(value).toLowerCase())) return true;
  if (['0', 'false', 'f', 'no', 'n'].includes(String(value).toLowerCase())) return false;
  throw new Error('allow_credit must be boolean');
};

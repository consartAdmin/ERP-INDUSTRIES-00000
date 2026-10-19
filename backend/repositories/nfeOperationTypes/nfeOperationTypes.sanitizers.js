// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeOperationTypes.sanitizers.js — Normalização de entrada          ║
// ╚════════════════════════════════════════════════════════════════════╝

export function positiveInteger(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function text(value, fallback = null) {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

export function boolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'sim', 'yes', 'on'].includes(String(value).toLowerCase());
}

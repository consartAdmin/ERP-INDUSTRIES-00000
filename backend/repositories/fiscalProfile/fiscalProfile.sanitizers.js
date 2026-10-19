// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalProfile.sanitizers.js — Normalização do payload              ║
// ╚════════════════════════════════════════════════════════════════════╝

import { STRING_FIELDS, NUMERIC_FIELDS, REFORMA_CODE_FIELDS } from './fiscalProfile.constants.js';

export const isFiniteNum = (value) => Number.isFinite(Number(value));
export const toNumOrNull = (value) =>
  value === '' || value == null
    ? null
    : (isFiniteNum(value) ? Number(value) : null);
export const toStrOrNull = (value) =>
  value === '' || value == null ? null : String(value).trim();
export const digitsOrNull = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits || null;
};

export function normalizeJsonObject(value, fieldName) {
  if (value == null || value === '') return {};

  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(`${fieldName} must contain valid JSON`);
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON object`);
  }

  return parsed;
}

export function normalizePayload(input = {}) {
  const out = {};

  for (const field of STRING_FIELDS) {
    if (field in input) out[field] = toStrOrNull(input[field]);
  }

  for (const field of NUMERIC_FIELDS) {
    if (field in input) out[field] = toNumOrNull(input[field]);
  }

  for (const [field, rule] of Object.entries(REFORMA_CODE_FIELDS)) {
    if (!(field in input)) continue;

    const value = digitsOrNull(input[field]);
    if (value && rule.exact && value.length !== rule.exact) {
      throw new Error(`${rule.label} must have exactly ${rule.exact} digits`);
    }
    if (value && rule.max && value.length > rule.max) {
      throw new Error(`${rule.label} must have at most ${rule.max} digits`);
    }
    out[field] = value;
  }

  if ('donation_indicator' in out && ![0, 1, null].includes(out.donation_indicator)) {
    throw new Error('donation_indicator must be 0 or 1');
  }

  if ('tax_reform_details' in input) {
    out.tax_reform_details = normalizeJsonObject(
      input.tax_reform_details,
      'tax_reform_details',
    );
  }

  if ('is_active' in input) {
    const value = input.is_active;
    out.is_active = typeof value === 'string'
      ? ['true', '1', 't', 'yes', 'y'].includes(value.toLowerCase())
      : Boolean(value);
  }

  return out;
}

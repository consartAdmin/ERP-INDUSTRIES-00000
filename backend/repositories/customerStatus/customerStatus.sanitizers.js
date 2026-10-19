// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatus.sanitizers.js — Validação/normalização de entrada   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { FIELDS } from './customerStatus.constants.js';

export const isFiniteNum = (v) => Number.isFinite(Number(v));
export const toNumOrNull = (v) => (isFiniteNum(v) ? Number(v) : null);
export const trimOrNull = (v) => (v ?? '').toString().trim() || null;

export function sanitizeCreate(input = {}) {
  return {
    customer_id: toNumOrNull(input.customer_id),
    status_type_id: toNumOrNull(input.status_type_id),
    note: trimOrNull(input.note),
    updated_by: toNumOrNull(input.updated_by),
  };
}

export function sanitizeUpdate(input = {}) {
  const out = {};
  for (const k of Object.keys(input || {})) {
    if (!FIELDS.includes(k)) continue;

    let v = input[k];
    if (k === 'customer_id' || k === 'status_type_id' || k === 'updated_by') {
      v = toNumOrNull(v);
    }
    if (k === 'note') v = trimOrNull(v);

    out[k] = v;
  }
  return out;
}

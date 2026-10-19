// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusTypes.sanitizers.js — Validação/normalização         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { FIELDS } from './customerStatusTypes.constants.js';

// Utils
export const isFiniteNum = (v) => Number.isFinite(Number(v));
export const toNumOrNull = (v) => (isFiniteNum(v) ? Number(v) : null);
export const trimOrNull = (v) => (v ?? '').toString().trim() || null;

/* ──────────────────────────────────────────────────────────
   Sanitização para CREATE e UPDATE
────────────────────────────────────────────────────────── */

export function sanitizeCreate(input = {}) {
  const out = {};

  for (const k of FIELDS) {
    let v = input[k];

    if (['name_pt', 'internal_code', 'description_en', 'color_hex'].includes(k)) {
      v = trimOrNull(v);
    }

    if (k === 'sort_order') {
      v = toNumOrNull(v);
    }

    if (k === 'is_active') {
      if (typeof v === 'boolean') {
        // ok
      } else if (v === 'true') {
        v = true;
      } else if (v === 'false') {
        v = false;
      } else {
        v = null;
      }
    }

    out[k] = v ?? null;
  }

  if (!out.is_active && out.is_active !== false) out.is_active = true;
  if (!out.sort_order && out.sort_order !== 0) out.sort_order = 0;

  return out;
}

export function sanitizeUpdate(input = {}) {
  const out = {};

  for (const k of Object.keys(input)) {
    if (!FIELDS.includes(k)) continue;
    let v = input[k];

    if (['name_pt', 'internal_code', 'description_en', 'color_hex'].includes(k)) {
      v = trimOrNull(v);
    }

    if (k === 'sort_order') {
      v = toNumOrNull(v);
    }

    if (k === 'is_active') {
      if (typeof v === 'boolean') {
        // ok
      } else if (v === 'true') {
        v = true;
      } else if (v === 'false') {
        v = false;
      } else {
        v = null;
      }
    }

    out[k] = v;
  }

  return out;
}

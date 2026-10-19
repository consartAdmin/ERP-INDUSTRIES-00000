// ╔════════════════════════════════════════════════════════════════════╗
// ║ grades.sanitizers.js — Helpers de conversão + normalizePayload     ║
// ╚════════════════════════════════════════════════════════════════════╝

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
export const isFiniteNum = (v) => Number.isFinite(Number(v));
export const toNumOrNull = (v) => (v === '' || v == null ? null : (isFiniteNum(v) ? Number(v) : null));
export const toStrOrNull = (v) => (v === '' || v == null ? null : String(v));

export function clampInt(n, { min = 0, max = 100000 } = {}) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(Math.max(Math.trunc(v), min), max);
}

/* ──────────────────────────────────────────────────────────────
   Normalizador de payload
────────────────────────────────────────────────────────────── */
export function normalizePayload(input = {}) {
  const out = {};

  // Campos string
  ['grade', 'description', 'source_system', 'source_hash'].forEach((k) => {
    if (k in input) out[k] = toStrOrNull(input[k]);
  });

  // Campos numéricos
  if ('version' in input) out.version = toNumOrNull(input.version);

  // Booleanos
  if ('is_active' in input) {
    const v = input.is_active;
    out.is_active = (typeof v === 'string')
      ? ['true', '1', 't', 'yes', 'y'].includes(v.toLowerCase())
      : Boolean(v);
  }

  return out;
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ processes.sanitizers.js — Helpers e normalizador de payload        ║
// ╚════════════════════════════════════════════════════════════════════╝

export const isFiniteNum = (v) => Number.isFinite(Number(v));
export const toNumOrNull = (v) => (v === '' || v == null ? null : (isFiniteNum(v) ? Number(v) : null));
export const toStrOrNull = (v) => (v === '' || v == null ? null : String(v));

export const toBoolOrNull = (v) => {
  if (v === '' || v == null) return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return !!v;
  if (typeof v === 'string') {
    return ['true', '1', 't', 'yes', 'y', 'sim', 's'].includes(v.toLowerCase());
  }
  return null;
};

/* ──────────────────────────────────────────────────────────────
   Normalizador de payload
────────────────────────────────────────────────────────────── */
export function normalizePayload(input = {}) {
  const out = {};

  // Strings principais
  ['codigo', 'nome', 'descricao', 'status'].forEach((k) => {
    if (k in input) out[k] = toStrOrNull(input[k]);
  });

  // Permite manipular deleted_at (se quiser fazer restore etc.)
  if ('deleted_at' in input) {
    out.deleted_at = input.deleted_at || null;
  }

  return out;
}

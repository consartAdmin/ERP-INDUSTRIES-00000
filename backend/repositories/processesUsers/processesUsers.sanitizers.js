// ╔════════════════════════════════════════════════════════════════════╗
// ║ processesUsers.sanitizers.js — Helpers e normalizador de payload   ║
// ╚════════════════════════════════════════════════════════════════════╝

export const isFiniteNum = (v) => Number.isFinite(Number(v));
export const toNumOrNull = (v) => (v === '' || v == null ? null : (isFiniteNum(v) ? Number(v) : null));

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

  if ('process_id' in input) out.process_id = toNumOrNull(input.process_id);
  if ('user_id' in input) out.user_id = toNumOrNull(input.user_id);

  ['can_view', 'can_edit', 'can_approve', 'is_owner'].forEach((k) => {
    if (k in input) out[k] = toBoolOrNull(input[k]);
  });

  if ('deleted_at' in input) {
    out.deleted_at = input.deleted_at || null;
  }

  return out;
}

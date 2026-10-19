// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerSegments.sanitizers.js — Validação/normalização de entrada ║
// ╚════════════════════════════════════════════════════════════════════╝

export const toStrOrNull = (v) =>
  v === '' || v == null ? null : String(v);

export const toBool = (v) => {
  if (v === '' || v == null) return null;
  if (typeof v === 'boolean') return v;

  const s = String(v).toLowerCase();

  if (['true', '1', 't', 'yes', 'y', 'sim', 's'].includes(s)) return true;
  if (['false', '0', 'f', 'no', 'n', 'nao', 'não'].includes(s)) return false;

  return null;
};

/**
 * Normaliza o payload externo.
 * IMPORTANTE:
 * - NÃO aceita segment_code no create/update.
 * - Código agora é controlado somente pelo backend.
 */
export function normalizePayload(input = {}) {
  const out = {};

  if ('segment_name' in input) out.segment_name = toStrOrNull(input.segment_name);
  if ('description' in input) out.description = toStrOrNull(input.description);

  if ('is_active' in input) {
    const b = toBool(input.is_active);
    if (b !== null) out.is_active = b;
  }

  return out;
}

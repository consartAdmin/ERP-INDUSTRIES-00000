// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerSubSegments.sanitizers.js — Validação/normalização entrada ║
// ╚════════════════════════════════════════════════════════════════════╝

export const isFiniteNum = (v) => Number.isFinite(Number(v));
export const toNumOrNull = (v) =>
  v === '' || v == null ? null : isFiniteNum(v) ? Number(v) : null;
export const toStrOrNull = (v) =>
  v === '' || v == null ? null : String(v);
export const toBool = (v) => {
  if (v === '' || v == null) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (['true', '1', 't', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'f', 'no', 'n'].includes(s)) return false;
  return null;
};

/**
 * Normaliza payload.
 * subsegment_code NÃO é aceito para evitar edição manual.
 */
export function normalizePayload(input = {}) {
  const out = {};

  if ('segment_id' in input) out.segment_id = toNumOrNull(input.segment_id);
  if ('subsegment_name' in input) out.subsegment_name = toStrOrNull(input.subsegment_name);
  if ('description' in input) out.description = toStrOrNull(input.description);

  if ('is_active' in input) {
    const b = toBool(input.is_active);
    if (b !== null) out.is_active = b;
  }

  if ('version' in input) out.version = toNumOrNull(input.version);
  if ('source_system' in input) out.source_system = toStrOrNull(input.source_system);
  if ('source_hash' in input) out.source_hash = toStrOrNull(input.source_hash);

  return out;
}

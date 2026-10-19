// ╔════════════════════════════════════════════════════════════════════╗
// ║ taskGroups.sanitizers.js — Normalização de entrada                 ║
// ╚════════════════════════════════════════════════════════════════════╝

export const toStrOrNull = (v) => (v === '' || v == null ? null : String(v).trim());
export const toBool = (v) => {
  if (v === '' || v == null) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  return ['true', '1', 't', 'yes', 'y', 'sim', 's'].includes(s);
};

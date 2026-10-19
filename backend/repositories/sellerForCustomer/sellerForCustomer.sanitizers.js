// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerForCustomer.sanitizers.js — Normalização de entrada          ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toBool(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (['1', 'true', 't', 'yes', 'y'].includes(s)) return true;
  if (['0', 'false', 'f', 'no', 'n'].includes(s)) return false;
  return undefined;
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenses.utils.js — Helpers puros (int, bool)                      ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toInt(v, d) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
}

export function normalizeBool(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (['true', '1', 'yes', 'y', 'sim'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'nao', 'não'].includes(s)) return false;
  return undefined;
}

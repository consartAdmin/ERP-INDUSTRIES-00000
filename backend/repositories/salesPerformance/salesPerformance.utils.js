// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesPerformance.utils.js — Helpers numéricos                      ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

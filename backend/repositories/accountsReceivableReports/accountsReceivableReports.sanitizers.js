// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableReports.sanitizers.js — Normalização de entrada  ║
// ╚════════════════════════════════════════════════════════════════════╝

export function positiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

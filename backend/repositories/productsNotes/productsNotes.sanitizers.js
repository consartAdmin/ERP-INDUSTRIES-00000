// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsNotes.sanitizers.js — Normalização de entrada              ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizeLimit(value, fallback = 100) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, 500);
}

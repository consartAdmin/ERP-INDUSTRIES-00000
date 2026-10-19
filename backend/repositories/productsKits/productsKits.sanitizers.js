// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKits.sanitizers.js — números / booleanos                   ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

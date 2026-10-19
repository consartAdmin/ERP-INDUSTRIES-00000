// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturesOrders.sanitizers.js — Número e texto seguros          ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toNumber(value, fallback = 0) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

export function safeText(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  const s = String(value).trim();
  return s || fallback;
}

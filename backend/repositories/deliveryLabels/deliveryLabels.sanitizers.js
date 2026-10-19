// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.sanitizers.js — Normalização de texto e número      ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizeText(value) {
  return value === undefined || value === null ? null : String(value).trim();
}

export function normalizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ locationsBarCode.sanitizers.js — Normalização do código de barras  ║
// ╚══════════════════════════════════════════════════════════════════════╝

export function normalizeBarcode(value) {
  return String(value || '').trim().toUpperCase();
}

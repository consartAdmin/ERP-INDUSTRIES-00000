// ╔════════════════════════════════════════════════════════════════════╗
// ║ usoConsumo.sanitizers.js — Normalização de texto / número          ║
// ╚════════════════════════════════════════════════════════════════════╝

export function safeText(value) {
  return String(value ?? '').trim();
}

export function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

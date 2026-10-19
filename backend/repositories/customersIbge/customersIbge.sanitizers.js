// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersIbge.sanitizers.js — Normalização UF/Cidade/IBGE/etc.     ║
// ╚════════════════════════════════════════════════════════════════════╝

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------
export const isFiniteNum = (v) => Number.isFinite(Number(v));

export function normUF(v) {
  const s = String(v ?? '').trim().toUpperCase();
  return s.slice(0, 2);
}

export function normCity(v) {
  return String(v ?? '').trim();
}

export function normIbge(v) {
  const s = String(v ?? '').trim();
  // mantém apenas dígitos se vier com máscara
  const digits = s.replace(/\D+/g, '');
  if (!digits) return null;
  return digits.slice(0, 7);
}

export function normSource(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return s || 'manual';
}

export function clampConfidence(v) {
  if (!isFiniteNum(v)) return 100;
  const n = Math.round(Number(v));
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGrades.sanitizers.js — Normalização de entrada             ║
// ╚════════════════════════════════════════════════════════════════════╝

export const toNumOrNull = (v) =>
(v === '' || v == null || Number.isNaN(Number(v))
  ? null
  : Number(v));

export const toStr = (v) => (v == null ? '' : String(v).trim());

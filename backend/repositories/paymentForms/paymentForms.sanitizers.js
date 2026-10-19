// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentForms.sanitizers.js — Normalização de entrada               ║
// ╚════════════════════════════════════════════════════════════════════╝

// Normaliza tPag para sempre ter 2 dígitos (ex.: 1 → '01')
export function normalizeTpag(value) {
  if (value == null) return null;
  const digits = String(value).replace(/\D+/g, '');
  if (!digits) return null;
  return digits.padStart(2, '0').slice(0, 2);
}

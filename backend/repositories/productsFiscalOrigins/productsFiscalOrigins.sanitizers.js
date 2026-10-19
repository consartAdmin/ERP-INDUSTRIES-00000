// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalOrigins.sanitizers.js — normalização de entrada        ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* ========================================================================== */
/* Helpers                                                                    */
/* ========================================================================== */

export function clean(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

export function toNullableNumber(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function normalizeCst(value) {
  const text = clean(value);
  if (!text) return null;

  const digits = text.replace(/\D/g, '');
  if (!digits) return null;

  // CST de ICMS tem 2 dígitos; CSOSN tem 3. Preserva o que veio da regra.
  return digits.length <= 2 ? digits.padStart(2, '0') : digits.slice(0, 3);
}

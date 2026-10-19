// ╔════════════════════════════════════════════════════════════════════╗
// ║ banks.sanitizers.js — Validação/normalização de entrada            ║
// ╚════════════════════════════════════════════════════════════════════╝

export function positiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function optionalText(value, maxLength) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}

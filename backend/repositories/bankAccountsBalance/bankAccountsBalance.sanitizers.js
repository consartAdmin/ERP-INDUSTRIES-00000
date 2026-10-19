// ╔════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsBalance.sanitizers.js — Validação/normalização         ║
// ╚════════════════════════════════════════════════════════════════════╝

export function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

export function positiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function requireId(value, label = 'ID') {
  const id = positiveId(value);
  if (!id) throw httpError(`${label} inválido.`);
  return id;
}

export function isoDate(value, label = 'Data') {
  const str = String(value ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) throw httpError(`${label} inválida.`);
  const d = new Date(`${str}T12:00:00`);
  if (Number.isNaN(d.getTime())) throw httpError(`${label} inválida.`);
  return str;
}

export function requireMoney(value, label) {
  if (value === '' || value === null || value === undefined) throw httpError(`Informe ${label}.`);
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) throw httpError(`${label} inválido.`);
  return Math.round(n * 100) / 100;
}

export function optionalText(value, max) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

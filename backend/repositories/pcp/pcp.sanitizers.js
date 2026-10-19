// ╔════════════════════════════════════════════════════════════════════╗
// ║ pcp.sanitizers.js — Validação/conversão de entrada (PCP)           ║
// ╚════════════════════════════════════════════════════════════════════╝

export const notEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

export const toText = (v) => {
  const s = String(v ?? '').trim();
  return s ? s : null;
};

export const toNum = (v, def = null) => {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : def;
};

export const toInt = (v, def = null) => {
  const n = toNum(v, def);
  return n === null ? null : Math.trunc(n);
};

export const toDate = (v) => {
  const s = toText(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

export function badRequest(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

export function notFound(message = 'Registro não encontrado.') {
  const e = new Error(message);
  e.status = 404;
  return e;
}

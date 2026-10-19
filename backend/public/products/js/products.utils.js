// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.utils.js — Utilitários do módulo de produtos               ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const qs = (s, el = document) => el.querySelector(s);
export const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));

export function fmtInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

export function fmtMoney(v) {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
}

export function fmtNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR') : '—';
}

export function sanitize(v) {
  return (v ?? '').toString().replace(
    /[<>&]/g,
    (s) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[s])
  );
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function dedupeById(rows) {
  const seen = new Set();
  return (rows || []).filter((r) => {
    const id = r?.product_id ?? r?.produto_id ?? r?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
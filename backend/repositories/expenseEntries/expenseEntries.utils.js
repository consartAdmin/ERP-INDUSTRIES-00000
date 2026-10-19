// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.utils.js — Helpers puros (paginação, XML, datas)    ║
// ╚════════════════════════════════════════════════════════════════════╝

/** paginação */
export function parsePaging({ page = 1, pageSize = 20 } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.min(200, Math.max(1, Number(pageSize) || 20));
  const offset = (p - 1) * ps;
  return { page: p, pageSize: ps, limit: ps, offset };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* XML Import (NF-e)                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export function pick(obj, path, fallback = null) {
  try {
    let cur = obj;
    for (const k of path.split('.')) {
      if (cur == null) return fallback;
      cur = cur[k];
      if (Array.isArray(cur)) cur = cur[0];
    }
    return cur ?? fallback;
  } catch {
    return fallback;
  }
}

export function toDateOnly(s) {
  if (!s) return null;
  const str = String(s);
  if (str.includes('T')) return str.slice(0, 10);
  if (str.length >= 10) return str.slice(0, 10);
  return null;
}

export function toNum(v, def = 0) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : def;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Bridge helpers: ExpenseEntry -> AccountsPayable (sem service separado)     */
/* ────────────────────────────────────────────────────────────────────────── */

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toISODateOnly(v) {
  if (!v) return null;

  // Date object
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  }

  const s = String(v).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return `${yyyy}-${mm}-${dd}`;
  }

  // Strings tipo: "Mon Feb 09" | "Mon Feb 09 2026"
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  throw new Error(`Data inválida: "${v}"`);
}

export function onlyDigits(v) {
  return String(v ?? '').replace(/\D+/g, '');
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ mobilized.sanitizers.js — Normalização de inteiros, numéricos,     ║
// ║ strings e paginação                                                ║
// ╚════════════════════════════════════════════════════════════════════╝

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
export const now = () => new Date();

export function asInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * numeric safe: não usa Number() para evitar perda de precisão.
 * Aceita number|string. Retorna string numérica normalizada ou null.
 */
export function asNumericStr(v, { allowNull = true } = {}) {
  if (v === null || v === undefined || v === '') return allowNull ? null : '0';

  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    return String(v);
  }

  const s = String(v).trim().replace(',', '.');
  if (!s) return allowNull ? null : '0';

  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return s;
}

export function safeStr(v, max = 255) {
  return String(v ?? '').trim().slice(0, max);
}

export function parseLimit(v, d = 50, max = 200) {
  const n = asInt(v);
  if (!n || n <= 0) return d;
  return Math.min(n, max);
}

export function parseOffset(v, d = 0) {
  const n = asInt(v);
  if (n === null || n < 0) return d;
  return n;
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashCategories.sanitizers.js — Validação/normalização de entrada   ║
// ╚════════════════════════════════════════════════════════════════════╝

export function asInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function safeStr(v, max = 100) {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
}

export function asBool(v, fallback = true) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const x = v.trim().toLowerCase();
    if (['true', '1', 't', 'yes', 'y', 'sim'].includes(x)) return true;
    if (['false', '0', 'f', 'no', 'n', 'nao', 'não'].includes(x)) return false;
  }
  if (typeof v === 'number') return v === 1;
  return fallback;
}

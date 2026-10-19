// ╔════════════════════════════════════════════════════════════════════╗
// ║ plano_acao.sanitizers.js — Normalização de entrada                 ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toInt(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

export function normalizeStr(v) {
  const s = String(v ?? '').trim();
  return s ? s : null;
}

export function parseDateOrNull(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;

  // Aceita YYYY-MM-DD ou DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

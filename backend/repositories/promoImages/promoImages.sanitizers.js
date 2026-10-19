// ╔════════════════════════════════════════════════════════════════════╗
// ║ promoImages.sanitizers.js — Normalização de texto, limite, preço   ║
// ╚════════════════════════════════════════════════════════════════════╝

export function safeText(v) {
  return String(v ?? '').trim();
}

export function safeLimit(v, def = 30) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.trunc(n), 100);
}

export function normalizePriceId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

export function escapeXml(v) {
  return safeText(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function sanitizeFileName(v) {
  return safeText(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

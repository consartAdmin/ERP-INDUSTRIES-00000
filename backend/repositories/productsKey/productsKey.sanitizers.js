// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKey.sanitizers.js — Normalização de texto / limites        ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizeKeyText(input) {
  const s = String(input ?? '').trim();
  if (!s) return '';

  // remove accents
  const noAccents = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // keep letters/numbers/spaces, convert separators to space
  const cleaned = noAccents
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

export function clampInt(n, def, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return def;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

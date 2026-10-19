// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsMobile.sanitizers.js — normalização de SKU / números / texto ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizeSku10(value) {
  const raw = String(value || '').trim();

  if (!raw) return '';

  if (/^\d+$/.test(raw) && raw.length < 10) {
    return raw.padStart(10, '0');
  }

  return raw;
}

export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeText(value) {
  return String(value || '').trim();
}

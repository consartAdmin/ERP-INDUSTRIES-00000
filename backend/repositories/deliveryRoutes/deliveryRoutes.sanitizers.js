// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRoutes.sanitizers.js — Validação/normalização de entrada   ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toInt(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function toBool(v, d = null) {
  if (v === true || v === false) return v;
  if (v === null || v === undefined) return d;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'sim'].includes(s)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'nao', 'não'].includes(s)) return false;
  return d;
}

export function normalizeWeekdays(weekdays) {
  if (weekdays == null) return [];
  if (Array.isArray(weekdays)) {
    return weekdays
      .map((x) => toInt(x, null))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  }
  const s = String(weekdays).replace(/[{}]/g, '').trim();
  if (!s) return [];
  return s
    .split(',')
    .map((x) => toInt(x.trim(), null))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
}

export function normalizeRouteType(v, d = 'customers') {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'customers' || s === 'suppliers') return s;
  return d;
}

export function cleanText(v, maxLen = null) {
  if (v === null || v === undefined) return null;
  const s = String(v);
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (maxLen && trimmed.length > maxLen) return trimmed.slice(0, maxLen);
  return trimmed;
}

export function coerceLinkByType(payload) {
  const t = normalizeRouteType(payload.route_type, 'customers');
  const out = { ...payload, route_type: t };

  if (t === 'customers') {
    out.supplier_id = null;
  } else {
    out.customer_id = null;
  }

  return out;
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsActiveBatch.sanitizers.js — normalização de ids / strings  ║
// ╚════════════════════════════════════════════════════════════════════╝

export const toInt = (v, fb = null) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : fb;
};

export const notEmptyStr = (s) => typeof s === 'string' && s.trim().length > 0;

export function normalizeIds(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => String(x ?? '').trim())
    .filter((x) => x.length > 0);
}

export function onlyNumericIds(arr) {
  return normalizeIds(arr)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n));
}

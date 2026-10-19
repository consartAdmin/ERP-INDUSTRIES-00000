// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventory.sanitizers.js — Helpers numéricos / safe parse           ║
// ╚════════════════════════════════════════════════════════════════════╝

// ──────────────────────────────────────────────────────────────
// Helpers numéricos / safe parse
// ──────────────────────────────────────────────────────────────
export const isFiniteNum = (v) => {
  if (v === '' || v == null) return false;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n);
};

export const toNumOrNull = (v) => (isFiniteNum(v) ? Number(String(v).replace(',', '.')) : null);

export function toIntOrNull(v) {
  if (v === '' || v == null) return null;
  const s = String(v).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function toBaseQty(countedQty, fator = 1) {
  const qty = Number(countedQty ?? 0);
  const factor = Number(fator ?? 1);
  if (!Number.isFinite(qty)) return null;
  if (!Number.isFinite(factor) || factor <= 0) return qty;
  return qty * factor;
}

export function addToMapNumber(map, key, value) {
  const current = Number(map.get(key) ?? 0);
  const next = current + Number(value ?? 0);
  map.set(key, next);
  return next;
}

export function chunkArray(arr, size = 500) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export function normalizeUserCtx(userCtx = {}) {
  const id = userCtx.id ?? userCtx.user_id ?? (typeof userCtx === 'number' ? userCtx : null);
  const name = userCtx.name ?? userCtx.user_name ?? userCtx.full_name ?? null;
  return { user_id: id ?? null, user_name: name ?? null };
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inventory.utils.js — Helpers (parse, focus, format, barcode)         ║
// ║ PRODNEX ERP | Inventário                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function toNumOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function isNumericId(v) {
  const s = String(v ?? '').trim();
  return /^\d+$/.test(s);
}

export function normalizeUnitText(v) {
  return String(v || '').toUpperCase().replace(/\s+/g, '').replace(/[.\-]/g, '');
}

export function isBarcodeLike(v) {
  const s = String(v || '').trim();
  return /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(s);
}

/* ──────────────────────────────────────────────────────────────
   Page detection (UX focus)
────────────────────────────────────────────────────────────── */
export const IS_INVENTORY_PAGE =
  /\/inventory\//i.test(location.pathname) ||
  /inventory\.html/i.test(location.pathname) ||
  document.documentElement?.dataset?.page === 'inventory';

export function focusCountedQty(els) {
  if (!IS_INVENTORY_PAGE) return;
  const el = els?.itemCountedQty;
  if (!el) return;
  requestAnimationFrame(() => { el.focus(); try { el.select?.(); } catch {} });
}

export function focusProductField(els) {
  if (!IS_INVENTORY_PAGE) return;
  const el = els?.itemProductCode;
  if (!el) return;
  requestAnimationFrame(() => { el.focus(); try { el.select?.(); } catch {} });
}

export function fmtQty3(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function fmtDatePt(d) {
  if (!d) return '';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('pt-BR');
}
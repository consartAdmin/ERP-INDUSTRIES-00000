export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
export const roundMm = (value) => Math.round(Number(value || 0) * 10) / 10;
export const mmToPx = (mm, scale = 5) => Number(mm || 0) * scale;
export const pxToMm = (px, scale = 5) => Number(px || 0) / scale;
export const ptToPx = (pt) => Number(pt || 0) * 1.3333;

export function toFiniteNumber(value, fallback = 0) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : fallback;
}

export function toNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const number = Number(text.replace(',', '.'));
  return Number.isNaN(number) ? null : number;
}

export function toInputNumber(value) {
  if (value == null || value === '') return '';
  const number = Number(value);
  return Number.isNaN(number) ? '' : String(number);
}

export function formatMm(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

export function safeNumber(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '-';
  return String(Number(value));
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function parseLayoutJson(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (error) {
    console.warn('[labelParameters] layout_json inválido:', error);
    return null;
  }
}


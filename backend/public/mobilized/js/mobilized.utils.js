'use strict';

import { API_BASE, IMAGE_EXTENSIONS } from './mobilized.config.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const setDisabled = (element, value) => { if (element) element.disabled = Boolean(value); };
export const toNumber = (value) => {
  if (value == null || value === '') return 0;
  const number = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
};
export const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
export const formatBRL = (value) => toNumber(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatNumber = (value, decimals = 2) => toNumber(value).toLocaleString('pt-BR', {
  minimumFractionDigits: decimals, maximumFractionDigits: decimals,
});
export function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function parseDateTimeLocal(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
export function notify(message, type = 'info') {
  if (type === 'error') console.error(message); else console.info(message);
  if (typeof window.showToast === 'function') window.showToast(message, type); else alert(message);
}
export const computeItemsTotal = (items = []) => items.reduce((sum, item) => sum + toNumber(item.total_value), 0);
export const imageCandidates = (sku) => IMAGE_EXTENSIONS.map((ext) => `${API_BASE}/public/imagens/${encodeURIComponent(String(sku || '').trim())}.${ext}`);
export function setImageWithFallback(image, urls = [], placeholder = '') {
  if (!image) return;
  const list = urls.filter(Boolean); let index = 0;
  const next = () => {
    if (index >= list.length) { image.onerror = null; image.src = placeholder; return; }
    image.onerror = () => { index += 1; next(); };
    image.src = list[index];
  };
  next();
}
export function extractNote(notes, key) {
  return String(notes || '').match(new RegExp(`(?:^|\\n)\\s*${key}:\\s*([^\\s]+)\\s*(?:$|\\n)`, 'i'))?.[1]?.trim() || null;
}
export function upsertNote(notes, key, value) {
  const lines = String(notes || '').split('\n'); let found = false;
  const output = lines.flatMap((line) => {
    if (!new RegExp(`^\\s*${key}:`, 'i').test(line)) return [line];
    found = true; return value ? [`${key}: ${value}`] : [];
  });
  if (!found && value) output.unshift(`${key}: ${value}`);
  return output.join('\n').trim();
}


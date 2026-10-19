import { DEFAULT_COLOR } from './customerStatusTypes.config.js';
export const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
export const isValidHexColor = (value) => /^#[0-9A-F]{6}$/i.test(String(value || '').trim());
export function normalizeHexColor(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';
  const normalized = raw.startsWith('#') ? raw : `#${raw}`;
  return isValidHexColor(normalized) ? normalized : raw;
}
export const safeColor = (value, fallback = DEFAULT_COLOR) => isValidHexColor(value) ? String(value).toUpperCase() : fallback;

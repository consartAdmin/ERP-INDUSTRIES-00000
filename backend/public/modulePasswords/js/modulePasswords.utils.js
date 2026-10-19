// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: modulePasswords.utils.js                                      ║
// ║ MODULE: Senhas dos Módulos — Utils                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const $ = (selector, root = document) => root.querySelector(selector);

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function fmtDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function normalizeCode(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

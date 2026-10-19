// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.utils.js — Shared utilities (PRODNEX ERP)            ║
// ║ Path: backend/public/expenseEntries/expenseEntries.utils.js          ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const $ = (selector) => document.querySelector(selector);

export function toast(message, type = 'info') {
  if (type === 'error') console.error(message);
  window.alert(message);
}

export function moneyBR(value) {
  const number = Number(value || 0);
  return number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function toISODate(date) {
  if (!date) return '';
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  return String(date).slice(0, 10);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function badge(status) {
  const normalized = String(status || 'OPEN').toUpperCase();
  const cssClass = normalized === 'POSTED'
    ? 'posted'
    : normalized === 'CANCELED'
      ? 'canceled'
      : 'open';

  return `<span class="ee-badge ${cssClass}">${normalized}</span>`;
}

export function canPost(status) {
  const normalized = String(status || 'OPEN').toUpperCase();
  return normalized !== 'POSTED' && normalized !== 'CANCELED';
}

export function canCancel(status) {
  return canPost(status);
}

export function canDelete(status) {
  return String(status || 'OPEN').toUpperCase() !== 'POSTED';
}


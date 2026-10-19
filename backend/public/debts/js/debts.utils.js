// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: debts.helpers.js                                              ║
// ║ MODULE: Debt Helpers                                                ║
// ║ DESCRIPTION: Numeric, money, date, query and modal helpers           ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

/* ──────────────────────────────────────────────────────────────────────
 * Numbers
 * ────────────────────────────────────────────────────────────────────── */

export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  let normalized = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(/R\$/gi, '');

  if (!normalized) {
    return fallback;
  }

  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  /*
   * Formato brasileiro:
   * 1.234,56
   * 234,56
   */
  if (hasComma) {
    normalized = normalized
      .replace(/\./g, '')
      .replace(',', '.');
  } else if (hasDot) {
    /*
     * Formato numérico/API:
     * 1234.56
     *
     * Não remove o ponto porque ele representa casas decimais.
     */
    const parts = normalized.split('.');

    /*
     * Caso raro com vários pontos e sem vírgula:
     * 1.234.567
     *
     * Considera os pontos como separadores de milhar.
     */
    if (parts.length > 2) {
      normalized = parts.join('');
    }
  }

  const number = Number(normalized);

  return Number.isFinite(number) ? number : fallback;
}

/* ──────────────────────────────────────────────────────────────────────
 * Money
 * ────────────────────────────────────────────────────────────────────── */

export function formatMoney(value) {
  const number = toNumber(value, 0);

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number);
}

/* ──────────────────────────────────────────────────────────────────────
 * HTML
 * ────────────────────────────────────────────────────────────────────── */

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* ──────────────────────────────────────────────────────────────────────
 * Dates
 * ────────────────────────────────────────────────────────────────────── */

export function formatDate(value) {
  if (!value) return '-';

  const raw = String(value).trim();

  if (!raw) return '-';

  /*
   * Aceita:
   * 2026-02-09
   * 2026-02-09T03:00:00.000Z
   */
  const datePart = raw.slice(0, 10);
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toLocaleDateString('pt-BR');
}

/* ──────────────────────────────────────────────────────────────────────
 * Query
 * ────────────────────────────────────────────────────────────────────── */

export function buildQuery(paramsObj = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(paramsObj).forEach(([key, value]) => {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return;
    }

    searchParams.set(key, String(value));
  });

  return searchParams.toString();
}

/* ──────────────────────────────────────────────────────────────────────
 * Modal
 * ────────────────────────────────────────────────────────────────────── */

export function openModal(modalEl) {
  if (!modalEl) return;

  modalEl.hidden = false;
  modalEl.classList.remove('hidden');
  modalEl.setAttribute('aria-hidden', 'false');
}

export function closeModal(modalEl) {
  if (!modalEl) return;

  modalEl.hidden = true;
  modalEl.classList.add('hidden');
  modalEl.setAttribute('aria-hidden', 'true');
}

/* ──────────────────────────────────────────────────────────────────────
 * Status
 * ────────────────────────────────────────────────────────────────────── */

export function getStatusBadge(status) {
  const normalizedStatus = String(status || 'EM_ABERTO').toUpperCase();

  const map = {
    EM_ABERTO: 'Em Aberto',
    PARCIAL: 'Parcial',
    PAGO: 'Pago',
    PAGA: 'Paga',
    VENCIDO: 'Vencido',
    VENCIDA: 'Vencida'
  };

  const label = map[normalizedStatus] || normalizedStatus;

  return `
    <span class="badge badge--${escapeHtml(normalizedStatus)}">
      ${escapeHtml(label)}
    </span>
  `;
}

export function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message || '';
  toast.className = `toast toast--${type}`;

  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.className = 'toast hidden';
  }, 3200);
}

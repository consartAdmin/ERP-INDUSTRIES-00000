// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfe.utils.js — Helpers DOM, texto e formatação              ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const $ = (selector) =>
  document.querySelector(selector);

export function normalizeText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function normalizeOptionalText(value) {
  return String(value ?? '').trim();
}

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

export function pick(row, ...keys) {
  for (const key of keys) {
    const value = row?.[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {
      return value;
    }
  }

  return '';
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatCpfCnpj(value) {
  const digits = onlyDigits(value);

  if (digits.length === 11) {
    return digits.replace(
      /(\d{3})(\d{3})(\d{3})(\d{2})/,
      '$1.$2.$3-$4'
    );
  }

  if (digits.length === 14) {
    return digits.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      '$1.$2.$3/$4-$5'
    );
  }

  return normalizeText(value);
}

export function formatMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '—';
  }

  return number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('pt-BR');
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function showToast(message, type = 'info') {
  const container = $('#toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';

    setTimeout(() => toast.remove(), 220);
  }, 3200);
}

export function setRetornoApi(data) {
  const el = $('#retornoApi');
  if (!el) return;

  try {
    el.textContent =
      typeof data === 'string'
        ? data
        : JSON.stringify(data, null, 2);
  } catch {
    el.textContent = String(data ?? '');
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterprise.utils.js                                                 ║
// ║ Utilitários do módulo Empresas                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const $ = (selector, root = document) => root.querySelector(selector);

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

export function applyCnpjMask(value) {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function applyCepMask(value) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
}

export function applyPhoneMask(value) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export function formatCnpj(value) {
  const digits = onlyDigits(value);
  return digits.length === 14 ? applyCnpjMask(digits) : String(value || '-');
}

export function normalizeDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export function getApiRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result?.items)) return result.items;
  return [];
}

export function getApiEntity(result) {
  return result?.data ?? result?.enterprise ?? result ?? null;
}

export function showMessage(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }

  window.alert(message);
}

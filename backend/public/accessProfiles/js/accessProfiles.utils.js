// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accessProfiles.utils.js                                             ║
// ║ Utilitários do Cadastro de Perfis                                   ║
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

export function getApiRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

/** Mesmo algoritmo do backend: "Vendedor Externo" → "VENDEDOR_EXTERNO" */
export function toCode(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
}

export function showMessage(message, type = 'info') {
  const alert = window.Alert;
  if (alert) {
    if (type === 'success') return alert.success('Cadastro de Perfis', message);
    if (type === 'error') return alert.error('Cadastro de Perfis', message);
    if (type === 'warn') return alert.warn('Cadastro de Perfis', message);
    return alert.info('Cadastro de Perfis', message);
  }

  window.alert(message);
}

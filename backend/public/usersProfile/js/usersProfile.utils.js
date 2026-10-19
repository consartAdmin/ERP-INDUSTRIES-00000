// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usersProfile.utils.js                                               ║
// ║ Utilitários do módulo Perfis de Usuários                            ║
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
  if (Array.isArray(result?.data?.rows)) return result.data.rows;
  return [];
}

export function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function showMessage(message, type = 'info') {
  const alert = window.Alert;
  if (alert) {
    if (type === 'success') return alert.success('Perfis de Usuários', message);
    if (type === 'error') return alert.error('Perfis de Usuários', message);
    if (type === 'warn') return alert.warn('Perfis de Usuários', message);
    return alert.info('Perfis de Usuários', message);
  }

  window.alert(message);
}

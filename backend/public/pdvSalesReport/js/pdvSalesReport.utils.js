export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => Array.from(document.querySelectorAll(selector));

export function formatCurrencyBR(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

export function formatDateBR(dateIso) {
  if (!dateIso) return '';
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function escapeHtml(value) {
  const element = document.createElement('div');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

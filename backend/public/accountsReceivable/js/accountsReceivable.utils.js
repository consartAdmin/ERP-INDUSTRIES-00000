export const $ = (selector, root = document) => root.querySelector(selector);

export function moneyBR(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function dateISO(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateBR(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
}

export function parseMoneyBR(value) {
  const normalized = String(value || '0')
    .replace(/[^\d,.-]/g, '')
    .replace('.', '')
    .replace(',', '.');
  return Number(normalized || 0);
}
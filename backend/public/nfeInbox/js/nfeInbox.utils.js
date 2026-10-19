/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ nfeInbox.utils.js — Utilitários | PRODNEX ERP (ESM)             ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
'use strict';

export function formatDate(value, dateOnly = false) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return dateOnly ? date.toLocaleDateString('pt-BR') : date.toLocaleString('pt-BR');
}

export const formatDateOnly = (value) => formatDate(value, true);

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function parseMoney(value = '') {
  const normalized = String(value).replace(/[R$\s.]/g, '').replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}

export function shortenKey(key = '') {
  const value = String(key);
  return value.length <= 20 ? value : `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export function getManifestLabel(manifestacao) {
  if (!manifestacao) return null;
  if (typeof manifestacao === 'string') return manifestacao;
  if (typeof manifestacao !== 'object') return null;

  const operation = manifestacao.operacao || manifestacao.tipo ||
    manifestacao.evento || manifestacao.codigo;
  if (!operation) return 'MANIFESTADA';

  const upper = String(operation).toUpperCase();
  if (upper.includes('CIEN')) return 'CIENTE';
  if (upper.includes('CONF')) return 'CONFIRMADA';
  if (upper.includes('DESC')) return 'DESCONHECIDA';
  if (upper.includes('NAO')) return 'NAO_REALIZADA';
  return upper;
}

export function getFilenameFromDisposition(disposition = '') {
  const encoded = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  const quoted = disposition.match(/filename\s*=\s*"([^"]+)"/i)?.[1];
  const plain = disposition.match(/filename\s*=\s*([^;]+)/i)?.[1];
  const value = encoded || quoted || plain;
  if (!value) return null;
  try { return decodeURIComponent(value.trim()); } catch { return value.trim(); }
}

export function downloadBlob(blob, filename = 'download.bin') {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Adia `fn` até parar de ser chamada por `delay` ms.
 * A função devolvida expõe `.cancel()` para descartar um disparo pendente
 * quando a mesma ação já foi executada por outro caminho (ex.: Enter).
 */
export function debounce(fn, delay = 300) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export function cssEscape(value) {
  if (globalThis.CSS?.escape) return CSS.escape(String(value));
  return String(value).replace(/["\\]/g, '\\$&');
}

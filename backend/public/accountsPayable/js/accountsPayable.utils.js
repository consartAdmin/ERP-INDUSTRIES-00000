'use strict';

export const qs = (selector, root = document) => root.querySelector(selector);

export function toInt(value) {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) ? null : number;
}

export function toFloat(value) {
  if (value === '' || value == null) return null;
  const number = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isNaN(number) ? null : number;
}

export function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatDate(value) {
  if (!value) return '';
  const raw = String(value);
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString('pt-BR');
}

export function toInputDate(value) {
  if (!value) return '';
  const raw = String(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function localDateTimeValue(date = new Date()) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

export function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.rows || payload?.items || payload?.data || [];
}

export function getFileExtension(filename) {
  return String(filename || '').split('.').pop().toLowerCase();
}

export function formatFileSize(size) {
  const bytes = Number(size || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

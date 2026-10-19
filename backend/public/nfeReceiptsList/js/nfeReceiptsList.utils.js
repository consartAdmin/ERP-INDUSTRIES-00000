// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsList.utils.js — Helpers puros (formatação e escape)      ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D+/g, '');
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
    minute: '2-digit'
  });
}

export function formatDocument(value) {
  const digits = onlyDigits(value);

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  return value ? String(value) : '-';
}

export function formatPhone(value) {
  const digits = onlyDigits(value);

  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');

  return value ? String(value) : '-';
}

export function hasCoordinates(row) {
  const lat = Number(row?.latitude);
  const lng = Number(row?.longitude);
  return row?.latitude != null && row?.longitude != null && Number.isFinite(lat) && Number.isFinite(lng);
}

export function buildMapsUrl(latitude, longitude) {
  return `https://www.google.com/maps?q=${encodeURIComponent(latitude)},${encodeURIComponent(longitude)}`;
}

export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

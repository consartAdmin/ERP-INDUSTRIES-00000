// ╔══════════════════════════════════════════════════════════════════════╗
// ║ transporters.utils.js — Utilitários do módulo Transportadoras       ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

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

export function formatCnpj(value) {
  const digits = onlyDigits(value).slice(0, 14);
  if (!digits) return '';

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formatCpf(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (!digits) return '';

  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatZipCode(value) {
  const digits = onlyDigits(value).slice(0, 8);
  if (!digits) return '';
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
}

export function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (!digits) return '';

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

export function normalizeState(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);
}

export function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

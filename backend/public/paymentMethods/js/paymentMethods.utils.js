// Payment Methods — shared utilities

'use strict';

import { GAP_FIELDS } from './paymentMethods.config.js';

export const $ = (selector, root = document) => root.querySelector(selector);

export function normalizeListResponse(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.rows)) return json.rows;
  return [];
}

export function normalizePaymentMethod(row = {}) {
  const id = row.id ?? row.paymentMethods_id ?? row.paymentmethods_id ?? '';

  const normalized = {
    id,
    paymentMethods_id: id,
    name: row.name ?? '',
    type: row.type ?? '',
    installments: row.installments ?? 1,
    nfe_tpag: row.nfe_tpag ?? '',
    active: ![false, 0, '0', 'false', null].includes(row.active),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };

  for (const field of GAP_FIELDS) normalized[field] = row[field] ?? 0;
  return normalized;
}

export function toInt(value, defaultValue = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? parseInt(number, 10) : defaultValue;
}

export function prettyDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('pt-BR');
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character]);
}

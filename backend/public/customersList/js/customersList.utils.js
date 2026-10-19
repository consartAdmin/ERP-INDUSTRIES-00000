// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customersList.utils.js                                        ║
// ║ MODULE: Customers List — Utilities                                  ║
// ║ PRODNEX ERP                                                         ║
// ║ DOM, normalization, formatting and HTTP helper functions            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const $ = (selector, root = document) => root.querySelector(selector);
export const safe = (value) =>
  value == null || value === '' ? '—' : String(value);
export const fmtBool = (value) =>
  value === true ? 'Ativo' : value === false ? 'Inativo' : '—';
export const onlyDigits = (value) =>
  String(value ?? '').replace(/\D+/g, '');

export function pick(...values) {
  for (const value of values) {
    if (value != null && value !== '') return value;
  }
  return null;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function normalizeRowsPayload(json) {
  if (Array.isArray(json)) return { rows: json, total: json.length };

  const root = json?.data ?? json;
  const rows =
    (Array.isArray(root?.rows) && root.rows) ||
    (Array.isArray(root?.items) && root.items) ||
    (Array.isArray(json?.rows) && json.rows) ||
    (Array.isArray(json?.items) && json.items) ||
    (Array.isArray(root) && root) ||
    [];

  const total =
    Number(pick(root?.total, json?.total, root?.count, json?.count, rows.length, 0)) || 0;

  return { rows, total };
}

export function normalizeArrayPayload(json) {
  if (Array.isArray(json)) return json;

  const candidates = [
    json?.ok ? json?.data : null,
    json?.data,
    json,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    for (const key of ['rows', 'items', 'result', 'data']) {
      if (Array.isArray(candidate?.[key])) return candidate[key];
    }
  }

  return [];
}

export async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

export async function fetchJsonTry(urls = []) {
  let lastError = null;

  for (const url of urls) {
    try {
      const output = await fetchJson(url);
      if (output.response.ok) return output.json;
      lastError = new Error(`HTTP ${output.response.status} em ${url}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Nenhuma rota respondeu com sucesso.');
}

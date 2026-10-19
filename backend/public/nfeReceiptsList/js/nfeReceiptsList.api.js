// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsList.api.js — Comunicação HTTP do módulo Canhotos        ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API_NFE_RECEIPTS } from './nfeReceiptsList.config.js';

export async function fetchJson(url, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };

  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : null;

  if (!response.ok || data?.ok === false) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Falha na requisição (${response.status}).`
    );
  }

  return data;
}

function buildQuery({ page, limit, q, status, dateFrom, dateTo } = {}) {
  const params = new URLSearchParams();

  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  return params.toString();
}

/**
 * Lista canhotos paginados.
 * Retorno: { ok, page, limit, total, rows }
 */
export function listReceipts(params = {}) {
  return fetchJson(`${API_NFE_RECEIPTS}?${buildQuery(params)}`);
}

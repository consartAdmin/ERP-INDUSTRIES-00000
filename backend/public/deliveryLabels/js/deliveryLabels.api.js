// ╔══════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.api.js — Comunicação com a API               ║
// ║ PRODNEX ERP | Frontend ESM                                  ║
// ╚══════════════════════════════════════════════════════════════╝

import { API_BASE, IMPORT_SOURCES } from './deliveryLabels.config.js';

export async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || data?.message || `Erro HTTP ${response.status}`);
  }

  return data;
}

export async function listDeliveryLabels(filters) {
  const params = new URLSearchParams();

  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  params.set('page', String(filters.page));
  params.set('limit', String(filters.rowsPerPage));

  const query = params.toString();
  const payload = await requestJson(query ? `${API_BASE}?${query}` : API_BASE);

  return normalizeListPayload(payload, filters);
}

export function createDeliveryLabel(data) {
  return requestJson(API_BASE, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function updateDeliveryLabel(id, data) {
  return requestJson(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export function deleteDeliveryLabel(id) {
  return requestJson(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

export function importDeliveryLabel(source, id) {
  const { endpoint } = IMPORT_SOURCES[source] || IMPORT_SOURCES.order;

  return requestJson(`${API_BASE}/${endpoint}/${encodeURIComponent(id)}`, {
    method: 'POST'
  });
}

export function buildPrintUrl(ids) {
  const normalizedIds = ids.map(Number).filter(Number.isFinite);
  return `${API_BASE}/print/pdf?ids=${encodeURIComponent(normalizedIds.join(','))}`;
}

export function getLabelSettings() {
  return requestJson(`${API_BASE}/settings`);
}

export function saveLabelSettings(settings) {
  return requestJson(`${API_BASE}/settings`, {
    method: 'PUT',
    body: JSON.stringify(settings)
  });
}

export function previewLabelSettings(settings) {
  return requestJson(`${API_BASE}/settings/preview`, {
    method: 'POST',
    body: JSON.stringify(settings)
  });
}

function normalizeListPayload(payload, filters) {
  const items = firstArray(
    payload,
    payload?.data,
    payload?.labels,
    payload?.rows,
    payload?.items,
    payload?.data?.labels,
    payload?.data?.rows,
    payload?.data?.items
  );

  const total = firstNumber(
    payload?.total,
    payload?.count,
    payload?.pagination?.total,
    payload?.data?.total,
    items.length
  );

  return {
    items,
    total,
    page: firstNumber(payload?.page, payload?.pagination?.page, filters.page),
    rowsPerPage: firstNumber(
      payload?.limit,
      payload?.pageSize,
      payload?.pagination?.limit,
      filters.rowsPerPage
    )
  };
}

function firstArray(...values) {
  return values.find(Array.isArray) || [];
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }

  return 0;
}

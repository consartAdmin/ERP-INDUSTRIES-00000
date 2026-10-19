// ╔══════════════════════════════════════════════════════════════════════╗
// ║ priceCommissions.api.js — Comunicação HTTP | PRODNEX ERP            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ROUTES } from './priceCommissions.config.js';

async function requestJSON(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  }

  return data;
}

export function listPriceCommissions(params = {}) {
  const query = new URLSearchParams(params).toString();
  return requestJSON(`${ROUTES.base}?${query}`);
}

export function listPrices() {
  return requestJSON(`${ROUTES.prices}?activeOnly=true`);
}

export function listSellers() {
  return requestJSON(`${ROUTES.sellers}?activeOnly=true`);
}

export function getPriceCommissionById(id) {
  return requestJSON(`${ROUTES.base}/${id}`);
}

export function createPriceCommission(payload) {
  return requestJSON(ROUTES.base, {
    method: 'POST',
    body: JSON.stringify(payload ?? {})
  });
}

export function updatePriceCommission(id, payload) {
  return requestJSON(`${ROUTES.base}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload ?? {})
  });
}

export function deletePriceCommission(id) {
  return requestJSON(`${ROUTES.base}/${id}`, {
    method: 'DELETE'
  });
}


// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsKits.api.js                                           ║
// ║ MODULE: Products Kits — API                                         ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ROUTES } from './productsKits.config.js';

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(
      data.error || data.message || `HTTP ${response.status}`
    );
  }

  return data;
}

export function listKits(params = {}) {
  const query = new URLSearchParams({
    q: params.q || '',
    active: params.active || 'all',
  });

  return requestJson(`${ROUTES.list}?${query.toString()}`);
}

export function getKit(id) {
  return requestJson(ROUTES.byId(id));
}

export function createKit(payload) {
  return requestJson(ROUTES.create, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateKit(id, payload) {
  return requestJson(ROUTES.update(id), {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deactivateKitById(id) {
  return requestJson(ROUTES.deactivate(id), {
    method: 'PATCH',
  });
}

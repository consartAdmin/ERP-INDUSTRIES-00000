import { ROUTES } from './prices.config.js';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(
      payload?.message || payload?.detail || `Erro HTTP ${response.status}`,
    );
  }
  return payload;
}

export function listPriceTables(params) {
  return fetchJson(`${ROUTES.list}?${params.toString()}`);
}

export function getPriceTable(id) {
  return fetchJson(ROUTES.byId(id));
}

export function createPriceTable(payload) {
  return fetchJson(ROUTES.list, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updatePriceTable(id, payload) {
  return fetchJson(ROUTES.byId(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deactivatePriceTable(id) {
  return fetchJson(ROUTES.byId(id), { method: 'DELETE' });
}

export function deletePriceTablePermanently(id) {
  return fetchJson(ROUTES.remove(id), { method: 'DELETE' });
}

export function restorePriceTable(id) {
  return fetchJson(ROUTES.restore(id), { method: 'POST' });
}

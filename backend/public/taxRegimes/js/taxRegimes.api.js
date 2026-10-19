// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: taxRegimes.api.js                                             ║
// ║ MODULE: Regime Tributário — API                                     ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_BASE = '/api/tax-regimes';

function headers() {
  const token = localStorage.getItem('token');

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: headers() });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || data?.message || `Erro ${response.status}`);
  }

  return data;
}

export function getOptions() {
  return request(`${API_BASE}/options`);
}

export function listTaxRegimes({ includeInactive = false } = {}) {
  return request(`${API_BASE}?includeInactive=${includeInactive ? 1 : 0}`);
}

export function createTaxRegime(payload) {
  return request(API_BASE, { method: 'POST', body: JSON.stringify(payload) });
}

export function updateTaxRegime(id, payload) {
  return request(`${API_BASE}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function setTaxRegimeActive(id, isActive) {
  return request(`${API_BASE}/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  });
}

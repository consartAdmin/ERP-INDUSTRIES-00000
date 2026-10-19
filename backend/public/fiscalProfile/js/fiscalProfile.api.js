// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalProfile.api.js                                          ║
// ║ MODULE: Fiscal Profile — API                                        ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API_BASE } from './fiscalProfile.config.js';

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error || data?.message || `Erro ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export async function listFiscalProfiles(params) {
  const response = await fetch(`${API_BASE}?${params.toString()}`);
  return parseResponse(response);
}

export async function createFiscalProfile(payload) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function updateFiscalProfile(id, payload) {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function deactivateFiscalProfile(id) {
  const response = await fetch(`${API_BASE}/${id}/active`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: false }),
  });

  return parseResponse(response);
}

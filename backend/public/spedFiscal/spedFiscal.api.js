// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscal.api.js — Comunicação com a API                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API_BASE } from './spedFiscal.config.js';
import { qs } from './spedFiscal.utils.js';

export async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Erro na requisição.');
  }

  return data;
}

export function getPreview(params) {
  return fetchJSON(`${API_BASE}/api/sped-fiscal/preview?${qs(params)}`);
}

export function validateSped(params) {
  return fetchJSON(`${API_BASE}/api/sped-fiscal/validate`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function generateSped(params) {
  return fetchJSON(`${API_BASE}/api/sped-fiscal/generate`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function getDownloadUrl(loteId) {
  return `${API_BASE}/api/sped-fiscal/${encodeURIComponent(loteId)}/download`;
}

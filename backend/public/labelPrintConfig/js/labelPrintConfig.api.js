// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: labelPrintConfig.api.js                                       ║
// ║ MODULE: Label Print Config — API                                    ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ROUTES } from './labelPrintConfig.config.js';

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.body,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof data === 'object'
        ? data.error || data.message || `HTTP ${response.status}`
        : data || `HTTP ${response.status}`;

    throw new Error(message);
  }

  return data;
}

export function getLabelPrintConfig() {
  return apiRequest(ROUTES.base);
}

export function updateLabelPrintConfig(payload) {
  return apiRequest(ROUTES.base, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function restoreLabelPrintConfig() {
  return apiRequest(ROUTES.reset, {
    method: 'POST',
  });
}

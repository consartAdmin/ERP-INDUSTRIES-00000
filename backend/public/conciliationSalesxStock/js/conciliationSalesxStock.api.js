'use strict';

import { API_URL } from './conciliationSalesxStock.config.js';

export async function fetchReconciliation(params) {
  const response = await fetch(`${API_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.message || `HTTP ${response.status}`);
  return payload;
}

export function exportReconciliationUrl(format, params) {
  const normalizedFormat = format === 'excel' ? 'excel' : 'pdf';
  return `${API_URL}/export/${normalizedFormat}?${params.toString()}`;
}

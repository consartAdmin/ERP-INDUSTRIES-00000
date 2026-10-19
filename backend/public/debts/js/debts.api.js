// js/debts.api.js
'use strict';

export const API_BASE = '/api';

export async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || 'Erro ao processar solicitação.');
  }

  return data;
}
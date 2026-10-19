// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEvents.api.js — Comunicação HTTP do módulo             ║
// ║ MODULE: NF-e Inutilização de Numeração                              ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { API_BASE } from './nfeInutilizarEvents.config.js';

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      (Array.isArray(data?.errors) ? data.errors.join(' ') : '') ||
      `HTTP ${response.status}`;

    const err = new Error(message);
    err.status = response.status;
    err.payload = data;
    throw err;
  }

  return data;
}

export function listInutilizacoes(params = new URLSearchParams()) {
  const qs = params?.toString?.() || '';
  return fetchJson(qs ? `${API_BASE}?${qs}` : API_BASE);
}

export function getInutilizacaoById(id) {
  return fetchJson(`${API_BASE}/${id}`);
}

export function createInutilizacao(payload) {
  return fetchJson(API_BASE, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function consultarInutilizacao(id) {
  return fetchJson(`${API_BASE}/${id}/consultar`);
}

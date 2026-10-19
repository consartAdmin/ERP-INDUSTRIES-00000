// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.api.js — Comunicação HTTP do Canhoto Digital            ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { RECEIPT_PATH } from './nfeReceipts.config.js';

async function fetchJson(url, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };

  if (options.body != null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json?.ok === false) {
    const error = new Error(json?.error || `HTTP_${response.status}`);
    error.status = response.status;
    throw error;
  }

  return json;
}

/** Busca o canhoto (cria como PENDING se ainda não existir, quando por número). */
export function getReceipt(identifier) {
  return fetchJson(RECEIPT_PATH(identifier));
}

export function signReceipt(identifier, payload) {
  return fetchJson(`${RECEIPT_PATH(identifier)}/sign`, {
    method: 'POST',
    body: JSON.stringify(payload || {})
  });
}

export function refuseReceipt(identifier, reason) {
  return fetchJson(`${RECEIPT_PATH(identifier)}/refuse`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

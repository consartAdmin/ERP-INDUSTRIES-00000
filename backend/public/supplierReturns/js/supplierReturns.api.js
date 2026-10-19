// ╔══════════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.api.js — Chamadas HTTP ao backend                    ║
// ║ PRODNEX ERP | Devolução ao Fornecedor                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ENDPOINT } from './supplierReturns.config.js';

function getErrorMessage(payload, fallback = 'Erro inesperado.') {
  return payload?.message || payload?.error || payload?.errors?.[0]?.message || fallback;
}

async function apiJson(url, options = {}) {
  const isFormData = options.body instanceof FormData;

  const response = await fetch(url, {
    ...options,
    headers: isFormData
      ? options.headers
      : {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.ok === false || payload.success === false) {
    throw new Error(getErrorMessage(payload, `Erro HTTP ${response.status}`));
  }

  return payload.data ?? payload;
}

export const ensureTablesRequest = () =>
  apiJson(`${ENDPOINT}/ensure`, { method: 'POST' });

export function importInboundXmlRequest(file) {
  const fd = new FormData();
  fd.append('xml', file);

  return apiJson(`${ENDPOINT}/import-inbound-xml`, {
    method: 'POST',
    body: fd,
  });
}

export const listReturnsRequest = (params) =>
  apiJson(`${ENDPOINT}?${params.toString()}`);

export const createReturnRequest = (payload) =>
  apiJson(ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const emitNfeRequest = (id) =>
  apiJson(`${ENDPOINT}/${id}/emit-nfe`, { method: 'POST' });

export const syncPlugNotasRequest = (id) =>
  apiJson(`${ENDPOINT}/${id}/sync-plugnotas`, { method: 'POST' });

export const deleteReturnRequest = (id) =>
  apiJson(`${ENDPOINT}/${id}`, { method: 'DELETE' });

export function getDownloadUrl(id, type) {
  const route = type === 'xml' ? 'xml' : 'danfe';
  return `${ENDPOINT}/${id}/${route}`;
}

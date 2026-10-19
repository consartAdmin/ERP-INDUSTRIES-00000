// ╔══════════════════════════════════════════════════════════════════════╗
// ║ transporters.api.js — Comunicação HTTP do módulo Transportadoras    ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API_TRANSPORTERS, API_PUBLIC_CNPJ, API_IBGE_RESOLVE_CITY } from './transporters.config.js';

export async function fetchJson(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = { ...(options.headers || {}) };

  if (!isFormData && options.body != null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (!headers.Accept) headers.Accept = 'application/json';

  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : null;

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Falha na requisição (${response.status}).`
    );
  }

  return data;
}

export function listTransporters() {
  return fetchJson(API_TRANSPORTERS);
}

export function createTransporter(payload) {
  return fetchJson(API_TRANSPORTERS, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateTransporter(id, payload) {
  return fetchJson(`${API_TRANSPORTERS}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function removeTransporter(id) {
  return fetchJson(`${API_TRANSPORTERS}/${id}`, { method: 'DELETE' });
}

// Consulta pública de CNPJ pelo backend CONSART.
// Mesma rota utilizada pelo customersEdit.
export function consultPublicCnpj(cnpj) {
  return fetchJson(API_PUBLIC_CNPJ(cnpj));
}

// Resolve o código IBGE da cidade sem bloquear o cadastro caso a resolução falhe.
export async function resolveIbgeCity(uf, city) {
  try {
    return await fetchJson(API_IBGE_RESOLVE_CITY(uf, city));
  } catch (error) {
    console.warn('[transporters.resolveIbgeCity]', error);
    return null;
  }
}

export function listTransporterAttachments(transporterId) {
  return fetchJson(`${API_TRANSPORTERS}/${transporterId}/attachments`);
}

export function uploadTransporterAttachment(transporterId, file) {
  const formData = new FormData();
  formData.append('file', file);

  return fetchJson(`${API_TRANSPORTERS}/${transporterId}/attachments`, {
    method: 'POST',
    body: formData
  });
}

export function removeTransporterAttachment(transporterId, attachmentId) {
  return fetchJson(
    `${API_TRANSPORTERS}/${transporterId}/attachments/${attachmentId}`,
    { method: 'DELETE' }
  );
}

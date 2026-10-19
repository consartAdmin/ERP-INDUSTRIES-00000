// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfe.api.js — Comunicação HTTP do módulo                    ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ROUTES } from './cancelarNfe.config.js';

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(options.headers || {}),
    },
  });

  const contentType =
    response.headers.get('content-type') || '';

  const payload =
    contentType.includes('application/json')
      ? await response.json()
      : await response.text();

  if (!response.ok) {
    const error = new Error(
      payload?.message ||
      payload?.error?.message ||
      payload?.error ||
      (typeof payload === 'string' ? payload : null) ||
      'Erro na requisição.'
    );

    error.status = response.status;
    error.payload = payload;

    throw error;
  }

  return payload;
}

function normalizeRowsPayload(data) {
  const candidates = [
    data?.data?.rows,
    data?.data?.items,
    data?.data?.invoices,
    data?.data,
    data?.rows,
    data?.items,
    data?.invoices,
    data,
  ];

  return candidates.find(Array.isArray) || [];
}

export async function listInvoicesIssued({
  search = '',
  limit = 100,
} = {}) {
  const url = new URL(
    ROUTES.invoicesIssued,
    window.location.origin
  );

  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', '0');

  if (search) {
    url.searchParams.set('q', search);
  }

  const data = await fetchJson(url.toString());

  return normalizeRowsPayload(data);
}

export async function listNfeStatusMap() {
  const url = new URL(
    ROUTES.nfeStatusMap,
    window.location.origin
  );

  url.searchParams.set('activeOnly', 'true');

  const data = await fetchJson(url.toString());

  return Array.isArray(data?.data)
    ? data.data
    : [];
}

export async function getNfeStatus(idNota) {
  return fetchJson(
    ROUTES.nfeStatus(idNota),
    { method: 'GET' }
  );
}

export async function requestNfeCancellation({
  idNota,
  justificativa,
}) {
  return fetchJson(
    ROUTES.requestCancellation,
    {
      method: 'POST',
      body: JSON.stringify({
        idNota,
        justificativa,
      }),
    }
  );
}

export async function getCancellationStatus(idNota) {
  return fetchJson(
    ROUTES.cancellationStatus(idNota),
    { method: 'GET' }
  );
}

export async function updateInvoiceIssuedStatus({
  invoiceId,
  statusId,
  statusCode,
  cancelledAt,
  reason,
}) {
  if (!invoiceId) {
    throw new Error(
      'invoice_id não informado para atualizar a NF-e emitida.'
    );
  }

  return fetchJson(
    `${ROUTES.invoicesIssued}/${encodeURIComponent(invoiceId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        nfe_status_id: statusId ?? null,
        nfe_status: statusCode,
        cancelled_at:
          cancelledAt || new Date().toISOString(),
        cancellation_reason: reason || null,
      }),
    }
  );
}

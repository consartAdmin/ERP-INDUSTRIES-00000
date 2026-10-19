// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscalBatch.api.js                                   ║
// ║ MODULE: Products Fiscal Batch — API                                ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API_BASE, ROUTES } from './productsFiscalBatch.config.js';
import { normalizeListPayload } from './productsFiscalBatch.utils.js';

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    let message = details;

    try {
      const parsed = details ? JSON.parse(details) : null;
      message = parsed?.message || parsed?.code || details;
    } catch {
      // Mantém a resposta textual quando ela não for JSON.
    }

    throw new Error(
      message || `${path} → ${response.status} ${response.statusText}`
    );
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function listProducts(params) {
  const searchParams = new URLSearchParams();

  if (params.search && params.search.length >= 3) {
    searchParams.set('q', params.search);
  }

  searchParams.set('limit', String(params.pageSize));
  searchParams.set('offset', String((params.page - 1) * params.pageSize));

  if (params.linkedFilter === 'linked') {
    searchParams.set('linked', 'true');
  }

  if (params.linkedFilter === 'unlinked') {
    searchParams.set('linked', 'false');
  }

  searchParams.set('_ts', String(Date.now()));

  const payload = await requestJson(
    `${ROUTES.batchList}?${searchParams.toString()}`
  );

  return normalizeListPayload(payload);
}

export async function listFiscalProfiles() {
  const payload = await requestJson(
    `${ROUTES.fiscalProfileList}?active=true&limit=200&offset=0`
  );

  return normalizeListPayload(payload).rows;
}

export function linkProductsFiscal(payload) {
  return requestJson(ROUTES.batchLink, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function unlinkProductFiscal(productCode) {
  const encodedProductCode = encodeURIComponent(
    String(productCode).trim()
  );

  return requestJson(
    `${ROUTES.unlinkCurrent}/${encodedProductCode}/close`,
    { method: 'POST' }
  );
}

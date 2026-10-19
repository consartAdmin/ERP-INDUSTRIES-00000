// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customerRegistration.api.js                                   ║
// ║ MODULE: Customer Registration — API                                 ║
// ║ PRODNEX ERP                                                         ║
// ║ Customer creation, select options, CEP and CNPJ requests            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ROUTES } from './customerRegistration.config.js';
import { buildLegacyPayload } from './customerRegistration.form.js';
import { readJson } from './customerRegistration.utils.js';

export async function createCustomer(payload) {
  const newResponse = await fetch(ROUTES.customersNew, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (newResponse.ok) return readJson(newResponse);

  const legacyResponse = await fetch(ROUTES.customersLegacy, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(buildLegacyPayload(payload)),
  });
  const json = await readJson(legacyResponse);

  if (!legacyResponse.ok) {
    const error = new Error(
      json?.message ||
      json?.error ||
      `HTTP ${legacyResponse.status}`
    );
    error.title = json?.title;
    error.customerId = json?.customer_id;
    throw error;
  }

  return json;
}

export async function fetchOptions(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  const json = await readJson(response);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.rows)) return json.rows;
  if (Array.isArray(json?.items)) return json.items;
  return [];
}

export async function fetchCep(cep) {
  const response = await fetch(ROUTES.consultaCep(cep), {
    headers: { Accept: 'application/json' },
  });
  const json = await readJson(response);
  if (!response.ok || json?.erro) {
    throw new Error('CEP não encontrado.');
  }
  return json;
}

export async function fetchCnpj(cnpj) {
  const response = await fetch(ROUTES.consultaCnpj(cnpj), {
    headers: { Accept: 'application/json' },
  });
  const json = await readJson(response);
  if (!response.ok) {
    throw new Error(json?.message || `HTTP ${response.status}`);
  }
  return json?.dados || json?.data || json;
}

export async function fetchIbgeUfs() {
  return fetchOptions(ROUTES.ibgeUfs);
}

export async function fetchIbgeCities(state) {
  return fetchOptions(ROUTES.ibgeCities(state));
}

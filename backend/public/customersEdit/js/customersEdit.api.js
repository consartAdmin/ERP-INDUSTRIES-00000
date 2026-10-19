// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customersEdit.api.js — Comunicação HTTP | PRODNEX ERP               ║
// ╚══════════════════════════════════════════════════════════════════════╝
'use strict';

import { CUSTOMERS_EDIT_ROUTES } from './customersEdit.config.js';

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  return data?.data ?? data;
}

export const getCustomerById = (id) => requestJson(CUSTOMERS_EDIT_ROUTES.customerById(id));

export const updateCustomerById = (id, payload) =>
  requestJson(CUSTOMERS_EDIT_ROUTES.customerById(id), {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const getSegments = () => requestJson(CUSTOMERS_EDIT_ROUTES.segments);
export const getClassifications = () => requestJson(CUSTOMERS_EDIT_ROUTES.classifications);
export const getSellers = () => requestJson(CUSTOMERS_EDIT_ROUTES.sellers);

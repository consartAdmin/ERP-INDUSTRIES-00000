// Payment Methods — HTTP access

'use strict';

import { PAYMENT_METHODS_API } from './paymentMethods.config.js';

async function request(url, options) {
  const response = await fetch(url, options);
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(json?.error || json?.message || response.statusText);
  }

  return json;
}

export function listPaymentMethods() {
  return request(`${PAYMENT_METHODS_API}?limit=200&offset=0`);
}

export function getPaymentMethod(id) {
  return request(`${PAYMENT_METHODS_API}/${encodeURIComponent(id)}`);
}

export function savePaymentMethod(id, payload) {
  return request(id ? `${PAYMENT_METHODS_API}/${encodeURIComponent(id)}` : PAYMENT_METHODS_API, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deletePaymentMethod(id) {
  return request(`${PAYMENT_METHODS_API}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function setPaymentMethodActive(id, active) {
  return request(`${PAYMENT_METHODS_API}/${encodeURIComponent(id)}/active`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  });
}

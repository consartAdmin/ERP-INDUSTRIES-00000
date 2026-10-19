// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalClassification.api.js                                  ║
// ║ MODULE: Fiscal Classification — API                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ROUTES } from './fiscalClassification.config.js';

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Erro ${response.status}`,
    );
  }
  return data;
}

export async function getJson(url) {
  const response = await fetch(url);
  return parseResponse(response);
}

export async function sendJson(url, method, body = null) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body == null ? null : JSON.stringify(body),
  });
  return parseResponse(response);
}

export const listFiscalClassifications = (url) => getJson(url);
export const listFiscalProfiles = (url) => getJson(url);
export const createFiscalClassification = (payload) =>
  sendJson(ROUTES.fiscalClassifications, 'POST', payload);
export const updateFiscalClassification = (id, payload) =>
  sendJson(ROUTES.fiscalClassificationById(id), 'PUT', payload);
export const deactivateFiscalClassification = (id) =>
  sendJson(ROUTES.fiscalClassificationActive(id), 'PATCH', { is_active: false });

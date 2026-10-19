// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscal.api.js                                         ║
// ║ MODULE: Products Fiscal — API                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ROUTES } from './productsFiscal.config.js';
import { state } from './productsFiscal.state.js';
import { debugError, debugLog } from './productsFiscal.utils.js';

export async function fetchJson(url, options = {}) {
  const startedAt = performance.now();
  const method = (options.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const requestBody = options.body && headers['Content-Type']?.includes('application/json')
    ? (() => {
        try { return JSON.parse(options.body); } catch { return options.body; }
      })()
    : options.body;

  state.lastHttp.request = { url, method, headers, body: requestBody };
  state.lastHttp.response = null;
  state.lastHttp.error = null;
  debugLog('HTTP →', method, url, requestBody || '');

  let response;
  let responseText;

  try {
    response = await fetch(url, { ...options, headers });
    responseText = await response.text();
  } catch (error) {
    state.lastHttp.error = { type: 'NETWORK', error: String(error) };
    debugError('NETWORK FAIL ←', method, url, error);
    throw error;
  } finally {
    debugLog(
      'HTTP ⏱',
      method,
      url,
      `${Math.round(performance.now() - startedAt)}ms`,
    );
  }

  let data;
  try { data = responseText ? JSON.parse(responseText) : null; } catch { data = responseText; }

  state.lastHttp.response = { status: response.status, ok: response.ok, data };
  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      data?.err ||
      data?.detail ||
      responseText ||
      `HTTP ${response.status}`;
    debugError('HTTP FAIL ←', method, url, { status: response.status, message, data });
    throw new Error(message);
  }

  debugLog('HTTP OK ←', method, url, data);
  return data;
}

export const getFiscalProfile = async (id) => {
  const response = await fetchJson(ROUTES.fiscalProfileById(id));
  return response?.data ?? response;
};
export const listProductsFiscal = (url) => fetchJson(url);
export const saveProductsFiscal = (payload) =>
  fetchJson(ROUTES.productsFiscalCurrent, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

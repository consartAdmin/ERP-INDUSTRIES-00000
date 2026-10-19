// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inventory.api.js — Fetch helpers (logs + body text)                  ║
// ║ PRODNEX ERP | Inventário                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getAuthHeaders } from './inventory.auth.js';
import { log, DEBUG } from './inventory.config.js';

export async function apiGet(url) {
  log('[apiGet] GET', url);
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  });
  const text = await res.text();
  log('[apiGet] status:', res.status);
  if (DEBUG) log('[apiGet] body:', text);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function apiPost(url, body) {
  log('[apiPost] POST', url, 'payload:', body);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  log('[apiPost] status:', res.status);
  if (DEBUG) log('[apiPost] body:', text);
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function apiPut(url, body) {
  log('[apiPut] PUT', url, 'payload:', body);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  log('[apiPut] status:', res.status);
  if (DEBUG) log('[apiPut] body:', text);
  if (!res.ok) throw new Error(`PUT ${url} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function apiDelete(url) {
  log('[apiDelete] DELETE', url);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  });
  const text = await res.text();
  log('[apiDelete] status:', res.status);
  if (DEBUG) log('[apiDelete] body:', text);
  if (!res.ok) throw new Error(`DELETE ${url} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}
'use strict';
import { BANKS_API } from './banks.config.js';
async function request(url, options = {}) {
  const response = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, ...options });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || body?.error || `HTTP ${response.status}`);
  return body;
}
export const listBanks = (params) => request(`${BANKS_API}?${params}`);
export const createBank = (data) => request(BANKS_API, { method: 'POST', body: JSON.stringify(data) });
export const updateBank = (id, data) => request(`${BANKS_API}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
export const deactivateBank = (id) => request(`${BANKS_API}/${encodeURIComponent(id)}`, { method: 'DELETE' });

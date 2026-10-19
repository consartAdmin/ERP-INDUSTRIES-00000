'use strict';
import { BANK_ACCOUNTS_API, BANKS_API } from './bankAccounts.config.js';
async function request(url, options = {}) { const response = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, ...options }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.message || body?.error || `HTTP ${response.status}`); return body; }
export const listBankAccounts = (params) => request(`${BANK_ACCOUNTS_API}?${params}`);
export const listBanks = () => request(`${BANKS_API}?active=true`);
export const createBankAccount = (data) => request(BANK_ACCOUNTS_API, { method: 'POST', body: JSON.stringify(data) });
export const updateBankAccount = (id, data) => request(`${BANK_ACCOUNTS_API}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
export const deactivateBankAccount = (id) => request(`${BANK_ACCOUNTS_API}/${encodeURIComponent(id)}`, { method: 'DELETE' });

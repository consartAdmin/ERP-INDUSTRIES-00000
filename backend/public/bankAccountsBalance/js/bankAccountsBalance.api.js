'use strict';

const API = '/api/bank-accounts-balance';

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.message || body?.error || `HTTP ${response.status}`);
  }
  return body;
}

export const getSummary = () => request(`${API}/summary`);

export const calculateBalance = ({ bankAccountId, date, excludeId }) => {
  const params = new URLSearchParams({ bank_account_id: bankAccountId, date });
  if (excludeId) params.set('exclude_id', excludeId);
  return request(`${API}/calculate?${params}`);
};

export const listCheckpoints = (params) => request(`${API}?${params}`);

export const createCheckpoint = (data) =>
  request(API, { method: 'POST', body: JSON.stringify(data) });

export const updateCheckpoint = (id, data) =>
  request(`${API}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteCheckpoint = (id) =>
  request(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });

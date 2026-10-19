import { API_URL } from './manufacturers.config.js';

async function request(url, options) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(response.statusText || `HTTP ${response.status}`);
    }
    const json = await response.json();
    return { ok: true, data: json.data || json };
  } catch (error) {
    console.error('[manufacturers API] error:', error);
    return { ok: false, error: error.message };
  }
}

export async function apiList({ page = 1, limit = 50, q = '' } = {}) {
  const url = new URL(API_URL);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(limit));
  if (q.trim()) url.searchParams.set('q', q.trim());

  const result = await request(url.toString());
  if (!result.ok) return result;
  const data = result.data;
  return {
    ok: true,
    rows: data.rows || [],
    total: data.total ?? 0,
    page: data.page ?? page,
    limit: data.limit ?? limit,
  };
}

export function apiGetById(id) {
  return request(`${API_URL}/${encodeURIComponent(id)}`);
}

export function apiCreate(payload) {
  return request(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function apiUpdate(id, payload) {
  return request(`${API_URL}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function apiDelete(id) {
  return request(`${API_URL}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

const BASE = '/api/nfe-operation-types';

function getAuthToken() {
  const keys = ['token', 'authToken', 'accessToken', 'access_token', 'jwt'];
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of keys) {
      const value = storage.getItem(key);
      if (value) return value.replace(/^Bearer\s+/i, '').trim();
    }
    const auth = storage.getItem('auth') || storage.getItem('user');
    if (auth) { try { const parsed = JSON.parse(auth); const value = parsed?.token || parsed?.accessToken || parsed?.access_token; if (value) return String(value).replace(/^Bearer\s+/i, '').trim(); } catch { } }
  }
  return null;
}

async function req(url, options = {}) {
  const token = getAuthToken();
  const r = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...options });
  const d = await r.json(); if (!r.ok) throw new Error(d.message || d.error || `HTTP ${r.status}`); return d;
}
export const list = (p) => req(`${BASE}?${new URLSearchParams(p)}`); export const create = (b) => req(BASE, { method: 'POST', body: JSON.stringify(b) }); export const update = (id, b) => req(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(b) });
export const remove = (id) => req(`${BASE}/${id}`, { method: 'DELETE' });

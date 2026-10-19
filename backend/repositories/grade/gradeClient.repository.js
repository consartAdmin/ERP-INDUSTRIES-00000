// ╔════════════════════════════════════════════════════════════════════╗
// ║ gradeClient.repository.js — HTTP util (fetch + timeout + JSON)     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { API, DEFAULT_TIMEOUT_MS } from './grade.constants.js';

// ──────────────────────────────────────────────────────────────────────────
// HTTP util
export async function httpJSON(path, { method='GET', headers={}, body, timeout=DEFAULT_TIMEOUT_MS } = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  const url = `${API}${path}`;
  const opts = { method, headers: { ...headers }, signal: c.signal };
  if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }

  try {
    const res = await fetch(url, opts);
    const ct = res.headers.get('content-type') || '';
    const isJson = ct.includes('application/json');

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const payload = isJson ? await res.json() : await res.text();
        if (payload && typeof payload === 'object') msg += ` — ${payload.error || payload.message || ''}`;
        else if (payload) msg += ` — ${payload}`;
      } catch {}
      throw new Error(msg);
    }

    return isJson ? await res.json() : await res.text();
  } finally {
    clearTimeout(t);
  }
}

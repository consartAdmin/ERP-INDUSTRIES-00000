// ╔══════════════════════════════════════════════════════════════════════╗
// ║ fetchJSON.js — helper fetch (PRODNEX ERP)                            ║
// ║ ✅ Envia token em Authorization e x-access-token                      ║
// ║ ✅ Detecta token mesmo com chave desconhecida                         ║
// ║ ✅ Cache control (noCache/cache) para evitar 304 em dashboards        ║
// ║ ✅ Retorno: { ok, data, error, status }                               ║
// ║ ✅ Header X-CRM-Company quando window.CRM_COMPANY existir             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export { fetchJSON };

function getToken() {
  const keys = [
    'CONSART_TOKEN',
    'token',
    'access_token',
    'auth_token',
    'jwt'
  ];

  for (const k of keys) {
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (v) return v;
  }

  return '';
}

async function parseAny(res) {
  const ct = res.headers.get('content-type') || '';

  if (ct.includes('json')) {
    try {
      return await res.json();
    } catch {}
  }

  try {
    return await res.text();
  } catch {}

  return null;
}

async function fetchJSON(url, options = {}) {
  const {
    method = 'GET',
    headers: customHeaders = {},
    body,
    auth = true,
    credentials = 'include',
    noCache = false
  } = options;

  const headers = new Headers(customHeaders);

  if (auth) {
    const token = getToken();

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('x-access-token', token);
    }
  }

  if (body && typeof body === 'object') {
    headers.set('Content-Type', 'application/json');
  }

  // CRM Consart ERP: a página define window.CRM_COMPANY = 'CONSART'
  // para o backend separar os cards do CRM Gestão de Vendas (BH3).
  if (window.CRM_COMPANY && !headers.has('X-CRM-Company')) {
    headers.set('X-CRM-Company', window.CRM_COMPANY);
  }

  const opts = {
    method,
    headers,
    credentials
  };

  if (body) {
    opts.body = JSON.stringify(body);
  }

  if (noCache) {
    opts.cache = 'no-store';
  }

  try {
    const res = await fetch(url, opts);
    const parsed = await parseAny(res);

    if (parsed && typeof parsed === 'object' && 'ok' in parsed) {
      return parsed;
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof parsed === 'string' && parsed ? parsed : 'HTTP_ERROR'
      };
    }

    return {
      ok: true,
      status: res.status,
      data: parsed
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err?.message || 'NETWORK_ERROR'
    };
  }
}
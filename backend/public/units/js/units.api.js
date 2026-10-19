// ╔════════════════════════════════════════════════════════════╗
// ║ units.api.js — API do módulo Unidades                       ║
// ║ PRODNEX ERP — compatível com respostas {rows}, {data},     ║
// ║ {data:{rows}}, arrays e paginação.                          ║
// ╚════════════════════════════════════════════════════════════╝

function getApiBase() {
  try {
    if (typeof window !== 'undefined' && typeof window.getApiBase === 'function') {
      return String(window.getApiBase() || '').replace(/\/+$/, '');
    }

    if (typeof window !== 'undefined' && window.apiBase) {
      return String(window.apiBase || '').replace(/\/+$/, '');
    }

    if (typeof window !== 'undefined' && window.API_BASE) {
      return String(window.API_BASE || '').replace(/\/+$/, '');
    }
  } catch (err) {
    console.error('[ERR] [units.api] Falha ao obter API base:', err);
  }

  return '';
}

function buildUrl(path) {
  const cleanPath = String(path || '').trim();

  if (/^https?:\/\//i.test(cleanPath)) {
    return cleanPath;
  }

  const base = getApiBase();

  // Se o apiBase já terminar em /api, não repetir /api.
  const normalizedBase = base.replace(/\/api$/i, '');

  return `${normalizedBase}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
}

function getAuthHeaders() {
  const headers = {
    Accept: 'application/json',
  };

  try {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('jwt');

    if (token) {
      headers.Authorization = token.startsWith('Bearer ')
        ? token
        : `Bearer ${token}`;
    }
  } catch (_) {
    // Alguns ambientes podem bloquear localStorage.
  }

  return headers;
}

async function request(path, options = {}) {
  const url = buildUrl(path);

  const headers = new Headers(getAuthHeaders());

  for (const [key, value] of Object.entries(options.headers || {})) {
    headers.set(key, value);
  }

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  console.info('[INFO] [units.api] GET/REQUEST:', url);

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  let payload = null;
  let rawText = '';

  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    rawText = await response.text();

    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      payload = null;
    }
  }

  console.info('[INFO] [units.api] Response:', response.status, payload);

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      rawText ||
      `HTTP ${response.status} — erro na operação de unidades.`;

    const error = new Error(String(message));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

/**
 * Aceita todos os formatos encontrados no CONSART:
 *
 * [
 *   {...}
 * ]
 *
 * { rows: [...] }
 *
 * { data: [...] }
 *
 * { data: { rows: [...] } }
 *
 * { units: [...] }
 *
 * { items: [...] }
 */
function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.units)) return payload.units;

  if (Array.isArray(payload.data)) return payload.data;

  if (payload.data && typeof payload.data === 'object') {
    if (Array.isArray(payload.data.rows)) return payload.data.rows;
    if (Array.isArray(payload.data.items)) return payload.data.items;
    if (Array.isArray(payload.data.units)) return payload.data.units;
  }

  return [];
}

export async function listUnits({
  search = '',
  includeInactive = false,
} = {}) {
  const params = new URLSearchParams();

  // O endpoint existente do CONSART já trabalha com onlyActive.
  if (!includeInactive) {
    params.set('onlyActive', 'true');
  }

  // Mantém busca no backend quando informada.
  if (String(search).trim()) {
    params.set('search', String(search).trim());
  }

  // Carrega o catálogo inteiro para a paginação ser controlada pelo frontend.
  params.set('limit', '9999');
  params.set('offset', '0');

  const query = params.toString();
  const payload = await request(`/api/units?${query}`);

  const rows = normalizeList(payload);

  console.info('[INFO] [units.api] Unidades normalizadas:', rows.length);

  return rows;
}

export async function createUnit(payload) {
  return request('/api/units', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUnit(id, payload) {
  const numericId = Number(id);

  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error('ID da unidade inválido.');
  }

  return request(`/api/units/${encodeURIComponent(numericId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteUnit(id) {
  const numericId = Number(id);

  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error('ID da unidade inválido.');
  }

  return request(`/api/units/${encodeURIComponent(numericId)}`, {
    method: 'DELETE',
  });
}

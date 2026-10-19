// ╔══════════════════════════════════════════════════════════════════════╗
// ║ apiFetch.js — Fetch com JWT automático (PRODNEX ERP)                 ║
// ║ - Injeta Authorization: Bearer <token>                               ║
// ║ - Trata 401 e mensagens do backend                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

export function getAuthToken() {
  // padronize 1 chave só no sistema inteiro:
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('token') ||
    null
  );
}

export async function apiFetch(url, options = {}) {
  const token = getAuthToken();

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // ✅ injeta token do jeito que teu middleware exige
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // tenta ler JSON sempre que possível
  let data = null;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    const text = await res.text().catch(() => '');
    data = text ? { ok: false, message: text } : null;
  }

  if (res.status === 401) {
    // aqui você pode redirecionar pro login se quiser
    const msg = data?.message || 'Não autorizado. Faça login novamente.';
    throw new Error(`401: ${msg}`);
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

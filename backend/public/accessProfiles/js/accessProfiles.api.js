// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accessProfiles.api.js                                               ║
// ║ Comunicação HTTP do Cadastro de Perfis                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ROUTES } from './accessProfiles.config.js';

function authHeaders() {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('token') ||
    '';

  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.ok === false) {
    const message =
      payload?.message ||
      payload?.error ||
      `Erro HTTP ${response.status} ao processar a solicitação.`;
    throw new Error(message);
  }

  return payload;
}

export function listProfiles({ search = '', onlyActive = '' } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (onlyActive) params.set('onlyActive', onlyActive);
  const query = params.toString();
  return fetchJson(query ? `${ROUTES.profiles}?${query}` : ROUTES.profiles);
}

export function createProfile(payload) {
  return fetchJson(ROUTES.profiles, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateProfile(id, payload) {
  if (!id) throw new Error('Perfil não informado.');
  return fetchJson(ROUTES.profileById(id), {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteProfile(id) {
  if (!id) throw new Error('Perfil não informado.');
  return fetchJson(ROUTES.profileById(id), { method: 'DELETE' });
}

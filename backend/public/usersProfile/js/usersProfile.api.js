// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usersProfile.api.js                                                 ║
// ║ Comunicação HTTP do módulo Perfis de Usuários                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ROUTES, USERS_LIMIT } from './usersProfile.config.js';

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

export function listUsers({ q = '', is_active = '' } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (is_active !== '') params.set('is_active', is_active);
  params.set('page', '1');
  params.set('limit', String(USERS_LIMIT));
  params.set('sort', 'name');

  return fetchJson(`${ROUTES.users}?${params.toString()}`);
}

export function getProfilesCatalog() {
  return fetchJson(`${ROUTES.profiles}?includeInactive=1`);
}

export function getProfilesSummary() {
  return fetchJson(ROUTES.summary);
}

export function getUserProfiles(userId) {
  if (!userId) throw new Error('Usuário não informado.');
  return fetchJson(ROUTES.userProfiles(userId));
}

export function saveUserProfiles(userId, modules) {
  if (!userId) throw new Error('Usuário não informado.');

  return fetchJson(ROUTES.userProfiles(userId), {
    method: 'PUT',
    body: JSON.stringify({ modules }),
  });
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterprise.api.js                                                   ║
// ║ Comunicação HTTP do módulo Empresas                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { LIST_LIMIT, ROUTES } from './enterprise.config.js';

async function fetchJson(url, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `Erro HTTP ${response.status} ao processar a solicitação.`;
    throw new Error(message);
  }

  return payload;
}

export async function listEnterprises({ q = '', is_active = '' } = {}) {
  const params = new URLSearchParams();

  if (q) params.set('q', q);
  if (is_active !== '') params.set('is_active', is_active);

  params.set('page', '1');
  params.set('limit', String(LIST_LIMIT));

  return fetchJson(`${ROUTES.enterprises}?${params.toString()}`);
}

export async function getEnterpriseById(id) {
  if (!id) throw new Error('ID da empresa não informado.');
  return fetchJson(ROUTES.enterpriseById(id));
}

export async function uploadEnterpriseLogo(id, file) {
  if (!id) throw new Error('ID da empresa não informado.');
  if (!(file instanceof File)) throw new Error('Selecione um arquivo de imagem válido.');

  const formData = new FormData();
  formData.append('logo', file, file.name);

  return fetchJson(ROUTES.enterpriseLogo(id), {
    method: 'POST',
    body: formData,
  });
}

export async function deleteEnterpriseLogo(id) {
  if (!id) throw new Error('ID da empresa não informado.');

  return fetchJson(ROUTES.enterpriseLogo(id), {
    method: 'DELETE',
  });
}

export async function updateEnterprise(id, payload) {
  if (!id) throw new Error('ID da empresa não informado.');

  return fetchJson(ROUTES.enterpriseById(id), {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

import { API_BASE } from './grades.config.js';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const error = new Error(data?.error || `Erro HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

export function getGrades({ query, status, limit, offset }) {
  const params = new URLSearchParams({ limit, offset });

  if (query.trim()) {
    params.set('q', query.trim());
  }

  if (status === 'ativo' || status === 'inativo') {
    params.set('is_active', status === 'ativo' ? 'true' : 'false');
  }

  return fetchJson(`${API_BASE}?${params}`);
}

export function createGrade({ grade, description }) {
  return fetchJson(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grade, description }),
  });
}

export function updateGrade(id, { description, isActive }) {
  return fetchJson(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description,
      is_active: isActive,
    }),
  });
}

export function deleteGrade(id) {
  return fetchJson(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
}

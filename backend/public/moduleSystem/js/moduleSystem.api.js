import { API_BASE } from './moduleSystem.config.js';
import { unwrapArray } from './moduleSystem.utils.js';

async function request(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

export async function buscarModulos(search = '') {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  const url = query.size ? `${API_BASE}?${query.toString()}` : API_BASE;
  return unwrapArray(await request(url));
}

export function salvarModulo({ id, ...dados }) {
  const editando = Boolean(id);
  return request(editando ? `${API_BASE}/${encodeURIComponent(id)}` : API_BASE, {
    method: editando ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
}

export function alterarStatusModulo(id, isActive) {
  return request(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  });
}

export function excluirModulo(id) {
  return request(`${API_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

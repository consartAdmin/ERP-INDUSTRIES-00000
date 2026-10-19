import { ROUTES } from './labelParameters.config.js';

async function request(url, options, context) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `${context} (HTTP ${response.status})`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function listParameters(params = new URLSearchParams()) {
  const query = params.toString();
  const data = await request(
    query ? `${ROUTES.list}?${query}` : ROUTES.list,
    undefined,
    'Erro ao listar parâmetros',
  );
  return Array.isArray(data) ? data : [];
}

export function saveParameter(id, payload) {
  return request(id ? ROUTES.byId(id) : ROUTES.list, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 'Erro ao salvar parâmetro');
}

export function deleteParameter(id) {
  return request(ROUTES.byId(id), { method: 'DELETE' }, 'Erro ao excluir parâmetro');
}


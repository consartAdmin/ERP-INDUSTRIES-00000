import { PRODUCTS_LM_REF_CONFIG } from './productsLmRef.config.js';

async function request(path = '', options = {}) {
  const response = await fetch(`${PRODUCTS_LM_REF_CONFIG.apiBaseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || `Request failed (${response.status}).`);
  return body;
}

export function fetchProductsLmRef(filters = {}) {
  const params = new URLSearchParams({ limit: PRODUCTS_LM_REF_CONFIG.pageSize });
  if (filters.search) params.set('search', filters.search);
  if (filters.isActive !== '') params.set('isActive', filters.isActive);
  return request(`?${params}`);
}

export const createProductLmRef = (data) => request('', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const updateProductLmRef = (id, data) => request(`/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(data),
});

export const deleteProductLmRef = (id) => request(`/${id}`, { method: 'DELETE' });


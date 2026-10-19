const BASE = `${(window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '')}/api/accounts-receivable-reports`;

export function queryString(filters) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== '' && value !== null && value !== false && value !== undefined) query.set(key, value); });
  return query.toString();
}

async function get(path, filters) {
  const response = await fetch(`${BASE}${path}?${queryString(filters)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.message || `Erro HTTP ${response.status}`);
  return payload;
}

export const fetchSummary = (filters) => get('/summary', filters);
export const fetchSales = (filters) => get('/sales', filters);
export const exportUrl = (filters) => `${BASE}/export/excel?${queryString(filters)}`;

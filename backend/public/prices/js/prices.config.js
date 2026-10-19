export const API_BASE = '/api/price-tables';

export const ROUTES = Object.freeze({
  list: API_BASE,
  byId: (id) => `${API_BASE}/${encodeURIComponent(id)}`,
  restore: (id) => `${API_BASE}/${encodeURIComponent(id)}/restore`,
  remove: (id) => `${API_BASE}/${encodeURIComponent(id)}/permanent`,
});

export const DEFAULT_FILTERS = Object.freeze({
  page: 1,
  limit: 50,
  q: '',
  status: 'all',
  sort: 'name',
  dir: 'asc',
});

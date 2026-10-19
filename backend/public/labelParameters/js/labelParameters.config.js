export const API_BASE =
  (typeof window !== 'undefined' && (window.API_BASE || window.apiBase)) || '';

export const ROUTES = Object.freeze({
  list: `${API_BASE}/api/label-parameters`,
  byId: (id) => `${API_BASE}/api/label-parameters/${encodeURIComponent(id)}`,
});

export const DESIGNER_SCALE_PX_PER_MM = 5;


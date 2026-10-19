export const API_BASE =
  (typeof window !== 'undefined' && (window.API_BASE || window.apiBase)) ||
  window.location.origin;

export const STORAGE_KEY = 'consart_labels_ui_config';

export const ROUTES = Object.freeze({
  parameters: `${API_BASE}/api/label-parameters?active=true`,
  prices: `${API_BASE}/api/prices?active=true`,
  productsSearch: `${API_BASE}/api/products/search`,
  generate: `${API_BASE}/api/labels/products`,
});

export const DEFAULT_TEMPLATE = 'default-product-label';


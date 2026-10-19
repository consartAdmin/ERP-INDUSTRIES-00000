const API_BASE =
  (typeof window !== 'undefined' && (window.API_BASE || window.apiBase)) ||
  window.location.origin;

export const REPORT_ENDPOINT = `${API_BASE}/api/reports/pdv-sales`;
export const REPORT_PDF_ENDPOINT = `${REPORT_ENDPOINT}/pdf`;
export const REPORT_CSV_ENDPOINT = `${REPORT_ENDPOINT}/csv`;

export const DEFAULT_TAB = 'day';
export const VALID_TABS = new Set(['day', 'customer', 'product']);

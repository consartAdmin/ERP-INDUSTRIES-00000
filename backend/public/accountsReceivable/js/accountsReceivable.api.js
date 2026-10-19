import { API_BASE } from './accountsReceivable.config.js';

const CASH_CATEGORIES_API =
  window.CASH_CATEGORIES_API || `${API_BASE}/cash-categories`;
const CASH_SUBCATEGORIES_API =
  window.CASH_SUBCATEGORIES_API || `${API_BASE}/cash-subcategories`;
const CASH_DOCUMENT_TYPES_API =
  window.CASH_DOCUMENT_TYPES_API || `${API_BASE}/cash-document-types`;
const CHART_OF_ACCOUNTS_API =
  window.CHART_OF_ACCOUNTS_API || `${API_BASE}/chart-of-accounts`;

export async function safeFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  }
  return data;
}

export const listAccounts = (params) => safeFetch(`${API_BASE}?${params}`);
export const listCashCategories = () => safeFetch(CASH_CATEGORIES_API);
export const listCashSubcategories = () => safeFetch(CASH_SUBCATEGORIES_API);
export const listCashDocumentTypes = () => safeFetch(CASH_DOCUMENT_TYPES_API);
export const listChartOfAccounts = () => safeFetch(CHART_OF_ACCOUNTS_API);
export const listBankAccounts = () => safeFetch(`${API_BASE}/bank-accounts`);
export const getAccount = (id) => safeFetch(`${API_BASE}/${encodeURIComponent(id)}`);
export const createAccount = (payload) => safeFetch(API_BASE, {
  method: 'POST', body: JSON.stringify(payload),
});
export const updateAccount = (id, payload) => safeFetch(`${API_BASE}/${encodeURIComponent(id)}`, {
  method: 'PUT', body: JSON.stringify(payload),
});
export const updateBoleto = (id, payload) => safeFetch(
  `${API_BASE}/${encodeURIComponent(id)}/boleto`,
  {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }
);
export const receiveAccount = (id, payload) => safeFetch(`${API_BASE}/${encodeURIComponent(id)}/receive`, {
  method: 'POST', body: JSON.stringify(payload),
});
export const cancelBoleto = (id) => safeFetch(`${API_BASE}/${encodeURIComponent(id)}/boleto`, {
  method: 'DELETE', body: JSON.stringify({ reason: 'Cancelado pelo usuário no ERP' }),
});
export const syncAsaas = (payload) => safeFetch(`${API_BASE}/sync-asaas`, {
  method: 'POST', body: JSON.stringify(payload),
});
/**
 * Sync com progresso: o backend responde NDJSON (uma linha JSON por evento).
 * onEvent recebe { type: 'start' | 'item' | 'done' | 'error', ... }.
 * Resolve com o result final ou lança erro.
 */
export async function syncAsaasStream(onEvent) {
  const response = await fetch(`${API_BASE}/sync-asaas?stream=1`, {
    method: 'POST',
    headers: { Accept: 'application/x-ndjson', 'Content-Type': 'application/json' },
    credentials: 'include',
    body: '{}',
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;

  const handleLine = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === 'error') throw new Error(event.message || 'Falha ao sincronizar com o Asaas.');
    if (event.type === 'done') result = event.result;
    onEvent?.(event);
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    lines.forEach(handleLine);
  }

  handleLine(buffer + decoder.decode());

  if (!result) throw new Error('A sincronização foi interrompida antes de terminar.');
  return result;
}

export const boletoUrl = (id) => `${API_BASE}/${encodeURIComponent(id)}/boleto`;
export const pdfUrl = (params) => `${API_BASE}/export/pdf?${params}`;
export const excelUrl = (params) => `${API_BASE}/export/excel?${params}`;

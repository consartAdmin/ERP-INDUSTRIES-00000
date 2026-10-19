// ╔══════════════════════════════════════════════════════════════════════╗
// ║ reportsProductsStock.api.js — API principal                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API_BASE } from './reportsProductsStock.utils.js';
import { buildQueryParams } from './reportsProductsStock.query.js';
import { state } from './reportsProductsStock.state.js';

export async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });

  if (!r.ok) {
    let msg = r.statusText;
    try { msg = await r.text(); } catch {}
    throw new Error(`HTTP ${r.status} — ${msg}`);
  }

  if (r.status === 204) return null;

  const ct = r.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('application/json')) {
    const preview = (await r.text().catch(() => '')).slice(0, 200).replace(/\s+/g, ' ');
    throw new Error(`Resposta não-JSON (${ct}). Corpo: ${preview || '(vazio)'}`);
  }

  return await r.json();
}

export async function fetchBlob(url, opts = {}) {
  const r = await fetch(url, opts);
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = await r.text(); } catch {}
    throw new Error(`HTTP ${r.status} — ${msg}`);
  }
  return await r.blob();
}

export async function loadRows() {
  const signal = state?.aborter?.signal;
  const sp = buildQueryParams({ forExport: false });
  const url = `${API_BASE}/api/products/stock-position?${sp.toString()}`;

  const res = await fetchJSON(url, { signal });
  const data = res?.data ?? res;
  const rows = Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []);
  const total = Number(data?.total);
  const outTotal = Number.isFinite(total) ? total : rows.length;
  const outPg = Number(data?.page ?? state.page) || state.page;
  const outLim = Number(data?.limit ?? state.limit) || state.limit;
  const summary = data?.summary && typeof data.summary === 'object' ? data.summary : null;

  return { rows, total: outTotal, page: outPg, limit: outLim, summary };
}

export async function downloadPdf() {
  const sp = buildQueryParams({ forExport: true });
  return await fetchBlob(`${API_BASE}/api/products/stock-position/pdf?${sp.toString()}`);
}

export async function downloadExcel() {
  const sp = buildQueryParams({ forExport: true });
  return await fetchBlob(`${API_BASE}/api/products/stock-position/excel?${sp.toString()}`);
}
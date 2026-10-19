// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ employees.api.js — APIs + fetchJSON + Signed PUT (PRODNEX ERP | ESM)         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
'use strict';

export const API_EMP = '/api/employees';
export const API_DOCS_BY_EMP = (id) => `/api/employees/${encodeURIComponent(id)}/documents`;
export const API_DOC_BY_ID   = (documentId) => `/api/employees/documents/${encodeURIComponent(documentId)}`;

export const API_SIGN_UPLOAD = (employeeId) => `/api/employees/${encodeURIComponent(employeeId)}/documents/sign`;
export const API_CONFIRM     = (employeeId) => `/api/employees/${encodeURIComponent(employeeId)}/documents/confirm`;
export const API_SIGN_READ   = (object) => `/api/employees/documents/sign-read?${new URLSearchParams({ object }).toString()}`;

/** ✅ fetchJSON com debug do body de erro */
export async function fetchJSON(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const hasBody = opts.body !== undefined && opts.body !== null;

  if (hasBody && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, { ...opts, headers });
  const text = await res.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    console.error('[fetchJSON] ERROR', { url, status: res.status, statusText: res.statusText, response: data });

    const errMsg =
      (data && (data.error || data.message)) ? (data.error || data.message)
      : `HTTP ${res.status}`;

    const err = new Error(errMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

/** ✅ PUT em signed URL (GCS) */
export async function putToSignedUrl(url, file) {
  const res = await fetch(url, {
    method: 'PUT',
    body: file,
    mode: 'cors',
  });

  console.log('[GCS PUT] status=', res.status, 'ok=', res.ok);

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`GCS PUT falhou: ${res.status} ${t}`);
  }
}
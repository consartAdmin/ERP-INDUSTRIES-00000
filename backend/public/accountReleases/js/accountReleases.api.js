// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accountReleases.api.js                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ROOT_API } from './accountReleases.helpers.js';

export const API = `${ROOT_API}/api/account-releases`;

export async function fetchJSON(url, opts = {}) {
  const isForm = opts.body instanceof FormData;

  const options = {
    ...opts,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(opts.headers || {}),
    },
  };

  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const msg = data?.details || data?.error || data?.message || res.statusText || 'Request failed';
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}

export const ensureRequest = () => fetchJSON(`${API}/ensure`);
export const searchReleasesRequest = (qs) => fetchJSON(`${API}?${qs.toString()}`);
export const getReleaseRequest = (id) => fetchJSON(`${API}/${encodeURIComponent(id)}`);
export const createReleaseRequest = (payload) => fetchJSON(`${API}`, { method: 'POST', body: JSON.stringify(payload) });
export const updateReleaseRequest = (id, payload) => fetchJSON(`${API}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteReleaseRequest = (id) => fetchJSON(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const sendReleaseRequest = (id) => fetchJSON(`${API}/${encodeURIComponent(id)}/send`, { method: 'POST' });
export const cancelReleaseRequest = (id) => fetchJSON(`${API}/${encodeURIComponent(id)}/cancel`, { method: 'POST' });

export const customerAttachmentsRequest = (customerId, qs) =>
  fetchJSON(`${API}/customers/${encodeURIComponent(customerId)}/attachments?${qs.toString()}`);

export const releaseAttachmentsRequest = (releaseId) =>
  fetchJSON(`${API}/${encodeURIComponent(releaseId)}/attachments?onlyActive=true`);

export const signAttachmentRequest = (payload) =>
  fetchJSON(`${API}/attachments/sign`, { method: 'POST', body: JSON.stringify(payload) });

export const confirmAttachmentRequest = (payload) =>
  fetchJSON(`${API}/attachments/confirm`, { method: 'POST', body: JSON.stringify(payload) });

export const confirmReleaseAttachmentRequest = (releaseId, payload) =>
  fetchJSON(`${API}/${encodeURIComponent(releaseId)}/attachments/confirm`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const deactivateAttachmentRequest = (id) =>
  fetchJSON(`${API}/attachments/${encodeURIComponent(id)}/deactivate`, { method: 'POST' });
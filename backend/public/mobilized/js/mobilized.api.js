'use strict';

import { MOBILIZED_API } from './mobilized.config.js';

async function request(url, options = {}, form = false) {
  const response = await fetch(url, {
    ...options,
    headers: form ? options.headers : { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const json = (response.headers.get('content-type') || '').includes('application/json');
  const body = json ? await response.json().catch(() => null) : await response.text().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.message || `HTTP ${response.status}`);
    error.status = response.status; error.body = body; throw error;
  }
  return body;
}

export const mobilizedApi = {
  list: (query) => request(`${MOBILIZED_API}?${query}`),
  get: (id) => request(`${MOBILIZED_API}/${id}`),
  create: (payload) => request(MOBILIZED_API, { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) => request(`${MOBILIZED_API}/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id) => request(`${MOBILIZED_API}/${id}`, { method: 'DELETE' }),
  listItems: (id) => request(`${MOBILIZED_API}/${id}/items`),
  createItem: (id, payload) => request(`${MOBILIZED_API}/${id}/items`, { method: 'POST', body: JSON.stringify(payload) }),
  updateItem: (id, payload) => request(`${MOBILIZED_API}/items/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  removeItem: (id) => request(`${MOBILIZED_API}/items/${id}`, { method: 'DELETE' }),
  generatePdf: (id) => request(`${MOBILIZED_API}/${id}/pdf/generate-upload`, { method: 'POST' }),
  uploadPdf: (id, data) => request(`${MOBILIZED_API}/${id}/pdf/upload`, { method: 'POST', body: data }, true),
  listAttachments: (mobilizedId) => request(`${MOBILIZED_API}/${mobilizedId}/attachments`),
  uploadItemAttachment: (mobilizedId, itemId, data) => request(
    `${MOBILIZED_API}/${mobilizedId}/items/${itemId}/attachments`,
    { method: 'POST', body: data },
    true
  ),
  removeAttachment: (mobilizedId, attachmentId) => request(
    `${MOBILIZED_API}/${mobilizedId}/attachments/${attachmentId}`,
    { method: 'DELETE' }
  ),
};

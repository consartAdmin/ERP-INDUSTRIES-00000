import { SUPPLIERS_API, attachmentsUrl } from './suppliers.config.js';
async function request(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.ok) throw new Error(json.error || json.message || 'Erro na operação.');
  return json.data;
}
export function listSuppliers(params) { return request(`${SUPPLIERS_API}?${params}`); }
export const getSupplier = (id) => request(`${SUPPLIERS_API}/${id}`);
export const createSupplier = (payload) => request(SUPPLIERS_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
export const updateSupplier = (id, payload) => request(`${SUPPLIERS_API}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
export const removeSupplier = (id) => request(`${SUPPLIERS_API}/${id}`, { method: 'DELETE' });
export const listAttachments = (id) => request(attachmentsUrl(id));
export const uploadSupplierAttachment = (id, file) => { const body = new FormData(); body.append('file', file); return request(attachmentsUrl(id), { method: 'POST', body }); };
export const removeSupplierAttachment = (supplierId, attachmentId) => request(`${attachmentsUrl(supplierId)}/${attachmentId}`, { method: 'DELETE' });
export async function downloadReport(format, params) {
  const response = await fetch(`${SUPPLIERS_API}/export/${format}?${params}`, { credentials: 'same-origin' });
  if (!response.ok) { const json = await response.json().catch(() => ({})); throw new Error(json.error || `Erro ao gerar relatório em ${format}.`); }
  return response;
}
export { default as sefazApi } from './suppliers.sefazApi.js';

'use strict';

import { API } from './accountsPayable.config.js';
import { extractRows } from './accountsPayable.utils.js';

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body && !(options.body instanceof Blob)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : {}; } catch { data = null; }
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || text || `Erro HTTP ${response.status}`);
  }
  return data ?? {};
}

export async function listAccounts(params) {
  const data = await request(`${API.base}?${params}`);
  const rows = extractRows(data);
  return { rows, total: Number(data.total ?? rows.length) };
}

export async function downloadExport(format, params) {
  const endpoint = format === 'pdf' ? API.exportPdf : API.exportExcel;
  const query = params?.toString();
  const response = await fetch(`${endpoint}${query ? `?${query}` : ''}`, {
    credentials: 'include',
    headers: { Accept: format === 'pdf' ? 'application/pdf' :
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Erro HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const filename = encodedName ? decodeURIComponent(encodedName) :
    (plainName || `contas-a-pagar.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function getAccount(id) {
  const data = await request(`${API.base}/${id}`);
  return data.data || data.item || data.row || data;
}

export async function getSupplier(id) {
  if (!id) return null;
  const data = await request(`/api/suppliers/${encodeURIComponent(id)}`);
  return data.data || data.item || data.row || data;
}

export const createAccount = (payload) =>
  request(API.base, { method: 'POST', body: JSON.stringify(payload) });

export const updateAccount = (id, payload) =>
  request(`${API.base}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const removeAccount = (id) =>
  request(`${API.base}/${id}`, { method: 'DELETE' });

export const createCashMovement = (payload) =>
  request(API.cash, { method: 'POST', body: JSON.stringify(payload) });

export const registerPayment = (id, payload) =>
  request(API.pay(id), { method: 'POST', body: JSON.stringify(payload) });

export async function listAttachments(id) {
  const data = await request(API.attachments(id));
  return Array.isArray(data) ? data : extractRows(data);
}

export async function getAttachmentDownloadUrl(accountPayableId, attachmentId) {
  const data = await request(
    `${API.attachments(accountPayableId)}/${encodeURIComponent(attachmentId)}/download`,
  );
  const url = data.signedUrl || data.url;
  if (!url) throw new Error('O backend não retornou a URL do anexo.');
  return url;
}

export const removeAttachment = (accountPayableId, attachmentId) =>
  request(
    `${API.attachments(accountPayableId)}/${encodeURIComponent(attachmentId)}`,
    { method: 'DELETE' },
  );

export async function listDocumentTypes() {
  return extractRows(await request(API.documentTypes));
}

export async function listCashCategories() {
  return extractRows(await request(API.cashCategories));
}

export async function listCashSubcategories(categoryId) {
  const params = new URLSearchParams({ categoria_id: categoryId });
  return extractRows(await request(`${API.cashSubcategories}?${params}`));
}

export async function listBankAccounts() {
  return extractRows(await request(API.bankAccounts));
}

export async function uploadAttachment(accountPayableId, file, onProgress = () => {}) {
  const mimeType = file.type || 'application/octet-stream';
  onProgress(10);
  const sign = await request(API.uploadSign, {
    method: 'POST',
    body: JSON.stringify({
      accountPayableId,
      filename: file.name,
      mimeType,
      fileSize: file.size,
    }),
  });
  const signedUrl = sign.signedUrl || sign.url;
  const object = sign.object || sign.meta?.gcs_path;
  const bucket = sign.bucket || sign.meta?.gcs_bucket;
  if (!signedUrl || !object || !bucket) {
    throw new Error('Assinatura de upload inválida: URL, bucket ou objeto ausente.');
  }
  onProgress(35);

  let upload;
  try {
    upload = await fetch(signedUrl, {
      method: sign.method || 'PUT',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: sign.headers && Object.keys(sign.headers).length
        ? sign.headers
        : { 'Content-Type': mimeType },
      body: file,
    });
  } catch (error) {
    console.error('[accountsPayable.api] GCS PUT network error:', error);
    throw new Error(
      'O navegador bloqueou o envio ao Cloud Storage. Verifique o CORS do bucket para a origem atual.',
      { cause: error },
    );
  }

  if (!upload.ok) {
    const details = await upload.text().catch(() => '');
    throw new Error(
      `Erro ao enviar arquivo para o bucket (HTTP ${upload.status})${details ? `: ${details}` : '.'}`,
    );
  }
  onProgress(75);
  const confirmation = await request(API.uploadConfirm, {
    method: 'POST',
    body: JSON.stringify({
      accountPayableId,
      filename: file.name,
      mimeType,
      fileSize: file.size,
      fileType: sign.fileType || sign.meta?.file_type,
      object,
      bucket,
      meta: sign.meta || undefined,
    }),
  });
  onProgress(100);
  return confirmation;
}

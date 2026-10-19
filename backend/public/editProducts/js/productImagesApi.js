// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productImagesApi.js — Frontend API | Imagens de Produtos           ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝
'use strict';

function getApiBase() {
  try {
    if (typeof window !== 'undefined' && typeof window.getApiBase === 'function') {
      return window.getApiBase();
    }
  } catch (_) {}
  return (typeof window !== 'undefined' && window.apiBase) || window.location.origin;
}

const API_BASE = getApiBase();

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
  });

  let data = null;
  try { data = await res.json(); } catch (_) {}

  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

function requireProductCode(productCode) {
  const code = String(productCode ?? '').trim();
  if (!code) throw new Error('productCode inválido.');
  return encodeURIComponent(code);
}

export async function listProductImages(productCode, { onlyActive = true } = {}) {
  const code = requireProductCode(productCode);
  const out = await request(`/api/products-imagens/by-code/${code}?onlyActive=${onlyActive ? 'true' : 'false'}`);
  return Array.isArray(out?.data) ? out.data : [];
}

export async function uploadProductImage(productCode, file, { barcodeId = null, isPrimary = false } = {}) {
  const code = requireProductCode(productCode);
  if (!(file instanceof File || file instanceof Blob)) throw new Error('Arquivo inválido.');

  const form = new FormData();
  form.append('file', file);
  // barcode_id vincula a imagem a uma unidade (productsBarCode); vazio = imagem geral.
  if (barcodeId != null) form.append('barcode_id', String(barcodeId));
  if (isPrimary) form.append('is_primary', 'true');

  const out = await request(`/api/products/${code}/imagem`, {
    method: 'POST',
    body: form,
  });
  return out?.data ?? out;
}

export async function setPrimaryProductImage(productCode, imageId) {
  const code = String(productCode ?? '').trim();
  const iid = Number(imageId);
  if (!code) throw new Error('productCode inválido.');
  if (!Number.isFinite(iid) || iid <= 0) throw new Error('imageId inválido.');

  const out = await request(`/api/products-imagens/${iid}/primary`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_code: code }),
  });
  return out?.data ?? out;
}

// fields: { barcode_id, image_alt, is_primary, position, ... } — barcode_id null = imagem geral.
export async function updateProductImage(imageId, fields = {}) {
  const id = Number(imageId);
  if (!Number.isFinite(id) || id <= 0) throw new Error('imageId inválido.');

  const out = await request(`/api/products-imagens/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  return out?.data ?? out;
}

// Unidades ativas do produto (productsBarCode) para vincular imagens.
export async function listProductUnits(productCode) {
  const code = requireProductCode(productCode);
  const out = await request(`/api/products/${code}/units`);
  return Array.isArray(out?.rows) ? out.rows : [];
}

// Avisa as outras telas (galeria / aba Unidades) que as imagens mudaram.
export const PRODUCT_IMAGES_CHANGED = 'product-images:changed';

export function notifyProductImagesChanged(source) {
  document.dispatchEvent(new CustomEvent(PRODUCT_IMAGES_CHANGED, { detail: { source } }));
}

export async function deleteProductImage(imageId, { hard = false } = {}) {
  const id = Number(imageId);
  if (!Number.isFinite(id) || id <= 0) throw new Error('imageId inválido.');
  const out = await request(`/api/products-imagens/${id}${hard ? '?hard=true' : ''}`, {
    method: 'DELETE',
  });
  return out?.data ?? out;
}

export default {
  listProductImages,
  uploadProductImage,
  setPrimaryProductImage,
  updateProductImage,
  listProductUnits,
  deleteProductImage,
};

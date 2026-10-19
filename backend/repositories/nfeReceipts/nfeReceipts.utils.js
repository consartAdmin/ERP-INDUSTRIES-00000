// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.utils.js — Helpers puros (sem acesso ao banco)         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ACCESS_KEY_LENGTH } from './nfeReceipts.constants.js';

export function cleanDigits(v = '') {
  return String(v || '').replace(/\D/g, '');
}

export function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normalizeStatus(v = '') {
  return String(v || '').trim().toUpperCase();
}

export function isIsoDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
}

/** Chave de acesso só com dígitos; lança INVALID_ACCESS_KEY se não tiver 44. */
export function requireAccessKey(accessKey) {
  const key = cleanDigits(accessKey);

  if (key.length !== ACCESS_KEY_LENGTH) {
    throw new Error('INVALID_ACCESS_KEY');
  }

  return key;
}

export function requireNfeId(nfeId) {
  const safeNfeId = toNumber(nfeId);

  if (!safeNfeId) {
    throw new Error('INVALID_NFE_ID');
  }

  return safeNfeId;
}

export function requireNfeNumber(nfeNumber) {
  const safeNumber = toNumber(nfeNumber);

  if (!safeNumber) {
    throw new Error('INVALID_NFE_NUMBER');
  }

  return safeNumber;
}

/** data:image/png;base64,... → Buffer (ou null quando não informado). */
export function decodeSignatureDataUrl(dataUrl) {
  if (!dataUrl) return null;

  const match = String(dataUrl).match(/^data:image\/png;base64,(.+)$/);

  if (!match) {
    throw new Error('INVALID_SIGNATURE_DATA_URL');
  }

  return Buffer.from(match[1], 'base64');
}

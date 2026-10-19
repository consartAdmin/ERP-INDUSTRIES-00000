// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentMethods.sanitizers.js — Normalização e validação de entrada ║
// ╚════════════════════════════════════════════════════════════════════╝

import { GAP_COLUMNS } from './paymentMethods.constants.js';

export function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

export function toBool(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 't', 'yes', 'y', 'sim', 's', 'on'].includes(normalized);
}

export function cleanText(value, fallback = null) {
  if (value == null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

export function normalizeGap(value) {
  if (value === '' || value == null) return null;
  return Math.max(0, toInt(value, 0));
}

export function normalizePayload(payload = {}) {
  const result = {
    name: cleanText(payload.name, ''),
    type: cleanText(payload.type, ''),
    installments: toInt(payload.installments, 1),
    nfe_tpag: cleanText(payload.nfe_tpag, null),
    active: typeof payload.active === 'undefined' ? true : toBool(payload.active),
  };

  for (const column of GAP_COLUMNS) {
    result[column] = normalizeGap(payload[column]);
  }

  return result;
}

export function validatePayload(payload) {
  if (!cleanText(payload.name, '')) {
    throw new Error('O campo "name" é obrigatório.');
  }

  if (!cleanText(payload.type, '')) {
    throw new Error('O campo "type" é obrigatório.');
  }

  if (!Number.isInteger(payload.installments) || payload.installments < 1 || payload.installments > 10) {
    throw new Error('O campo "installments" deve ser um inteiro entre 1 e 10.');
  }

  if (payload.nfe_tpag != null && !/^\d{2}$/.test(payload.nfe_tpag)) {
    throw new Error('O campo "nfe_tpag" deve possuir exatamente dois dígitos.');
  }
}

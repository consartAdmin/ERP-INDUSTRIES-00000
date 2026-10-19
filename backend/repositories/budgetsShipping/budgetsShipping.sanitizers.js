// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsShipping.sanitizers.js — Normalização do payload de frete     ║
// ║ toNumber / toInt / toBool / cleanText / onlyDigits / normalizePayload ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { COLUMNS, WRITE_COLUMNS } from './budgetsShipping.constants.js';

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;

  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;

  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback = true) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  const text = String(value).trim().toLowerCase();

  if (['true', 't', '1', 'yes', 'y', 'sim', 's', 'on'].includes(text)) return true;
  if (['false', 'f', '0', 'no', 'n', 'nao', 'não', 'off'].includes(text)) return false;

  return fallback;
}

function cleanText(value) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  return text || null;
}

function onlyDigits(value) {
  const text = cleanText(value);
  if (!text) return null;

  return text.replace(/\D+/g, '') || null;
}

const NORMALIZERS = { toNumber, toInt, toBool, cleanText, onlyDigits };

// Columns filled from the request body (budget_id comes from the route param).
const BODY_COLUMNS = WRITE_COLUMNS.filter((column) => COLUMNS[column].source !== 'param');

for (const column of BODY_COLUMNS) {
  const { normalize } = COLUMNS[column];

  if (!NORMALIZERS[normalize]) {
    throw new Error(`[budgetsShippingApi] Unknown normalizer "${normalize}" for column "${column}".`);
  }
}

function pickValue(body, column) {
  const keys = [column, ...(COLUMNS[column].aliases || [])];

  for (const key of keys) {
    if (body[key] !== null && body[key] !== undefined) return body[key];
  }

  return undefined;
}

export function normalizePayload(body = {}) {
  const data = {};

  for (const column of BODY_COLUMNS) {
    const { normalize, fallback = null } = COLUMNS[column];
    data[column] = NORMALIZERS[normalize](pickValue(body, column), fallback);
  }

  return data;
}

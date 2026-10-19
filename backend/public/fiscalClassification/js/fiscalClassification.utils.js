// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalClassification.utils.js                                ║
// ║ MODULE: Fiscal Classification — Utilities                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return Array.isArray(payload?.rows) ? payload.rows : [];
}

export function toNullableText(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

export function toNumber(value, fallback = 0) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!normalized) return fallback;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

export function logError(context, error) {
  console.error(`[fiscalClassification] ${context}`, error);
}

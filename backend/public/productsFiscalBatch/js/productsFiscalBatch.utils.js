// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscalBatch.utils.js                                 ║
// ║ MODULE: Products Fiscal Batch — Utilities                          ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function debounce(callback, delay = 400) {
  let timeoutId;

  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...args), delay);
  };
}

export function queryAll(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function normalizeListPayload(payload) {
  if (Array.isArray(payload)) {
    return {
      rows: payload,
      total: payload.length,
    };
  }

  const rows = payload?.rows ?? payload?.data ?? payload?.items ?? [];
  const total = Number(
    payload?.total ??
    payload?.count ??
    payload?.pagination?.total ??
    rows.length
  );

  return {
    rows: Array.isArray(rows) ? rows : [],
    total: Number.isFinite(total) ? total : 0,
  };
}

export function getErrorMessage(error, fallback) {
  return error instanceof Error && error.message
    ? error.message
    : fallback;
}


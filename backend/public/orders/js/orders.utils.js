// orders.utils.js — Orders module
'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: orders.utils.js                                                ║
// ║ MODULE: Orders                                                       ║
// ║ PRODNEX ERP                                                          ║
// ║ Utility helpers                                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝


export const $ = (selector, root = document) =>
  root.querySelector(selector);

export function parseISODateOnly(iso) {

  if (!iso) return null;

  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');

  return isNaN(d.getTime()) ? null : d;
}

export function daysSince(dateIso) {

  const d = parseISODateOnly(dateIso);

  if (!d) return null;

  const today = new Date();

  const t0 = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const diff = Math.floor(
    (t0.getTime() - d.getTime()) / 86400000
  );

  return diff >= 0 ? diff : 0;
}

export function setVal(id, value) {

  const el = $(`#${id}`);

  if (el) el.value = value ?? '';
}

export function normalizeStatus(v) {

  const s = String(v || '').trim().toUpperCase();

  if (s === 'CANCELADO') return 'CANCELADO';

  if (s.startsWith('CANCEL')) return 'CANCELADO';

  if (s === 'FATURADO') return 'FATURADO';

  if (s.startsWith('FATUR')) return 'FATURADO';

  return s;
}

export const fmtMoney = (v) =>

  Number(v || 0).toLocaleString('pt-BR', {

    minimumFractionDigits: 2,
    maximumFractionDigits: 2

  });

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: orders.debug.js                                                ║
// ║ MODULE: Orders                                                       ║
// ║ PRODNEX ERP                                                          ║
// ║ Debug utilities                                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝


export const DEBUG_ORDERS = true;

export function dlog(...args) {

  if (!DEBUG_ORDERS) return;

  console.log(
    '%c[orders:debug]',
    'color:#2563eb;font-weight:700',
    ...args
  );
}

export function dsafeStringify(obj, maxLen = 8000) {

  try {

    const s = JSON.stringify(obj, null, 2);

    return s.length > maxLen
      ? s.slice(0, maxLen) + '\n…(truncado)'
      : s;

  } catch {

    return String(obj);
  }
}

export function dget(obj, path) {

  try {

    return path.split('.')
      .reduce((acc, key) =>
        acc && acc[key] !== undefined ? acc[key] : undefined, obj);

  } catch {

    return undefined;
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: orders.toast.js                                                ║
// ║ MODULE: Orders                                                       ║
// ║ PRODNEX ERP                                                          ║
// ║ Toast wrapper                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝


export const toast = {

  info: (title, message, ms = 3800) =>

    showCenterModal({
      variant: 'info',
      title,
      message,
      timeoutMs: ms
    }),

  success: (title, message, ms = 4200) =>

    showCenterModal({
      variant: 'success',
      title,
      message,
      timeoutMs: ms
    }),

  warn: (title, message) =>

    showCenterModal({
      variant: 'warning',
      title,
      message
    }),

  error: (title, message) =>

    showCenterModal({
      variant: 'error',
      title,
      message
    }),

};

export { showCenterModal };

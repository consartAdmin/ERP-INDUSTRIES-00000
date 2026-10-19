// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: locationsBarCode.utils.js                                    ║
// ║ MODULE: Locations Barcode — Utilities                              ║
// ║ PRODNEX ERP · Frontend · ESM                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

export function safeRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

export function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function setValue(selector, value) {
  const element = $(selector);
  if (element) element.value = value ?? '';
}

export function debounce(callback, wait = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), wait);
  };
}

export function focusScanner() {
  setTimeout(() => $('#scannerInput')?.focus(), 300);
}


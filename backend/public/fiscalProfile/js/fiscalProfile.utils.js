// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalProfile.utils.js                                        ║
// ║ MODULE: Fiscal Profile — Utilities                                  ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

export function qsa(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

export function numberOrNull(value) {
  return value === '' || value == null ? null : Number(value);
}

export function scrollToPageTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


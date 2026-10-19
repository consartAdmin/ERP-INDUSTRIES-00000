// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscal.utils.js                                       ║
// ║ MODULE: Products Fiscal — Utilities                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state } from './productsFiscal.state.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const byId = (id) => document.getElementById(id);
export const value = (id) => byId(id)?.value ?? '';
export const mapNull = (input) =>
  input === '' || input === undefined ? null : input;
export const asNumberOrNull = (input) =>
  input === '' || input == null
    ? null
    : Number.isFinite(Number(input))
      ? Number(input)
      : null;
export const pick = (object, ...keys) =>
  keys.reduce((result, key) => result ?? object?.[key], null);

window.__PF_DEBUG = window.__PF_DEBUG ?? true;

export function debugLog(...args) {
  if (window.__PF_DEBUG) {
    console.log('%c[PF]', 'color:#2b6df6;font-weight:700', ...args);
  }
}

export function debugWarn(...args) {
  if (window.__PF_DEBUG) {
    console.warn('%c[PF]', 'color:#f59e0b;font-weight:700', ...args);
  }
}

export function debugError(...args) {
  console.error('%c[PF]', 'color:#ef4444;font-weight:700', ...args);
}

export function setDebug(data) {
  const debugBox = byId('debug_box');
  if (!debugBox) return;

  const payload = { ...data, lastHttp: { ...state.lastHttp } };
  try {
    const current = debugBox.textContent?.trim()
      ? JSON.parse(debugBox.textContent)
      : {};
    debugBox.textContent = JSON.stringify({ ...current, ...payload }, null, 2);
  } catch {
    debugBox.textContent = JSON.stringify(payload, null, 2);
  }
}

export function installGlobalErrorLogging() {
  window.addEventListener('error', (event) => {
    debugError(
      'window.error:',
      event.message,
      event.filename,
      event.lineno,
      event.colno,
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    debugError('unhandledrejection:', event.reason);
  });
}

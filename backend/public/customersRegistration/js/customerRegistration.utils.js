// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customerRegistration.utils.js                                 ║
// ║ MODULE: Customer Registration — Utilities                           ║
// ║ PRODNEX ERP                                                         ║
// ║ DOM access, text normalization and JSON request helpers             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const $ = (selector, root = document) => root.querySelector(selector);

export function getValue(id) {
  return document.getElementById(id)?.value ?? '';
}

export function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value ?? '';
}

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

export function trimOrNull(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

export async function readJson(response) {
  return response.json().catch(() => ({}));
}

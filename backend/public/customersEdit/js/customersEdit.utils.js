// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customersEdit.utils.js — Utilitários | PRODNEX ERP                  ║
// ╚══════════════════════════════════════════════════════════════════════╝
'use strict';

export const $ = (selector, root = document) => root.querySelector(selector);
export const byId = (id) => document.getElementById(id);
export const getValue = (id) => byId(id)?.value ?? '';

export function setValue(id, value) {
  const element = byId(id);
  if (element) element.value = value ?? '';
}

export const onlyDigits = (value) => String(value ?? '').replace(/\D+/g, '');
export const trimOrNull = (value) => String(value ?? '').trim() || null;
export const normalizeUf = (value) => String(value ?? '').trim().toUpperCase().slice(0, 2);

export function debounce(callback, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}

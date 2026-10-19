// ╔══════════════════════════════════════════════════════════════════════╗
// ║ reportsProductsStock.utils.js — Utilitários                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const API_BASE = (window.apiBase || window.location.origin || '').replace(/\/+$/, '');

export function fmtInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

export function fmtNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR') : '—';
}

export function fmtMoney(v) {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
}

export function sanitize(v) {
  return (v ?? '').toString().replace(/[<>&]/g, s => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
  }[s]));
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
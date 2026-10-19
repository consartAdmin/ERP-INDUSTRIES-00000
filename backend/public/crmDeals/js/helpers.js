// ╔══════════════════════════════════════════════════════════════════════╗
// ║ helpers.js — CRM Reativação (PRODNEX ERP)                            ║
// ║ Utils (escape/format/normalize)                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function formatSellerLabel(deal) {
  const name = (deal?.seller_name ?? deal?.sellerName ?? '').toString().trim();
  const nickname = (deal?.seller_nickname ?? deal?.sellerNickname ?? deal?.nickname ?? '').toString().trim();

  const cleaned = name
    .replace(/\s*\(([^)]+)\)\s*$/g, (m, inside) => {
      if (inside.trim().toLowerCase() === name.replace(m, '').trim().toLowerCase()) return '';
      return m;
    })
    .trim();

  const base = cleaned || name;
  if (!base && !nickname) return 'Sem vendedor';

  if (nickname && base && nickname.toLowerCase() !== base.toLowerCase()) return `${nickname} (${base})`;
  return nickname || base || 'Sem vendedor';
}

export function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(dateIso) {
  try {
    return new Date(dateIso).toLocaleDateString('pt-BR');
  } catch {
    return dateIso;
  }
}

export function normalizeCode(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function escapeAttr(str) {
  return escapeHtml(str).replaceAll(' ', '_');
}

export function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
  return String(value).replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
}

export function cssEscapeAttr(value) {
  return String(value).replace(/"/g, '\\"');
}

// ✅ evita erro "background inválido" quando a cor não é HEX
export function alphaBg(color, alpha = 0.12) {
  const c = String(color || '').trim();
  const hex = c.startsWith('#') ? c.slice(1) : '';
  const isHex = /^[0-9a-fA-F]{6}$/.test(hex);

  if (!isHex) return `rgba(100,116,139,${alpha})`; // fallback slate

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
// ╔══════════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.utils.js — Helpers de DOM, formatação e mensagens    ║
// ║ PRODNEX ERP | Devolução ao Fornecedor                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function numberBr(value, digits = 4) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function setMessage(text, type = '') {
  const el = qs('#importMessage');
  if (!el) return;

  el.textContent = text || '';
  el.classList.toggle('is-error', type === 'error');
  el.classList.toggle('is-success', type === 'success');
}

export function setLoading(button, loading, textWhenLoading = 'Processando...') {
  if (!button) return;

  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.textContent = textWhenLoading;
    button.disabled = true;
    return;
  }

  button.innerHTML = button.dataset.originalHtml || button.innerHTML;
  button.disabled = false;
}

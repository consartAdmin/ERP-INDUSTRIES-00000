/* ╔══════════════════════════════════════════════════════════════════╗
   ║ inboundInvoices.utils.js — Helpers, mensagens e utilitários              ║
   ║ PRODNEX ERP | Frontend (ESM)                                      ║
   ║ ✅ + confirmDanger(): substitui window.confirm por modal CONSART   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];

function getBase() {
  return (window.API_BASE || '').replace(/\/$/, '');
}

const toast = {
  info: (title, msg) =>
    showCenterModal({ variant: 'info', title, message: msg, timeoutMs: 3500 }),
  success: (title, msg) =>
    showCenterModal({ variant: 'success', title, message: msg, timeoutMs: 4000 }),
  warn: (title, msg) =>
    showCenterModal({ variant: 'warning', title, message: msg, timeoutMs: null }),
  error: (title, msg) =>
    showCenterModal({ variant: 'error', title, message: msg, timeoutMs: null }),
};

function moneyBR(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function normalizeUnitCode(v) {
  if (!v) return '';
  const s = String(v).trim();
  const code = s
    .split('—')[0]
    .split('-')[0]
    .trim()
    .split(/\s+/)[0]
    .trim();
  return code.toUpperCase();
}

function normalizeRows(resp) {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp.rows)) return resp.rows;
  if (Array.isArray(resp?.data?.rows)) return resp.data.rows;
  return [];
}

function formatDateBR(d) {
  if (!d) return '';
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('pt-BR');
  } catch {
    return String(d);
  }
}

/**
 * Confirmação CONSART (substitui window.confirm).
 * Retorna boolean:
 *   true  -> confirmou (ex: Excluir)
 *   false -> cancelou/fechou
 */
async function confirmDanger(opt = {}) {
  const title = opt.title || 'Confirmar ação';
  const message = opt.message || 'Deseja continuar?';
  const confirmText = opt.confirmText || 'Confirmar';
  const cancelText = opt.cancelText || 'Cancelar';

  const res = await showCenterModal({
    variant: opt.variant || 'warning',
    title,
    message,
    timeoutMs: null, // confirmação NÃO deve sumir
    buttons: [
      { label: cancelText, variant: 'cancel' },
      {
        label: confirmText,
        variant: 'danger',
        action: async () => true,
      },
    ],
  });

  return res === true;
}

export const core = {
  qs,
  qsa,
  getBase,
  toast,
  moneyBR,
  normalizeUnitCode,
  normalizeRows,
  formatDateBR,
  confirmDanger, // ✅ exporta
};

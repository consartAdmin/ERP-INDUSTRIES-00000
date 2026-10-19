// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.utils.js — Helpers puros                                ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ACCESS_KEY_LENGTH } from './nfeReceipts.config.js';

export function onlyDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

export function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';

  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

export function show(el) {
  el?.classList.remove('hidden');
}

export function hide(el) {
  el?.classList.add('hidden');
}

/**
 * Lê a NF-e da URL: ?key=<44 dígitos> ou ?numero= / ?number= / ?nfe=
 * (usado por links/QR codes que abrem o canhoto já identificado).
 */
export function getIdentifierFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const key = onlyDigits(params.get('key') || params.get('chave'));
  if (key.length === ACCESS_KEY_LENGTH) return { type: 'key', value: key };

  const number = onlyDigits(params.get('numero') || params.get('number') || params.get('nfe'));
  if (number) return { type: 'number', value: number };

  return null;
}

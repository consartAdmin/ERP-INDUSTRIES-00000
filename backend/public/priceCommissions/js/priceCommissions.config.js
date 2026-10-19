// ╔══════════════════════════════════════════════════════════════════════╗
// ║ priceCommissions.config.js — Configuração e DOM | PRODNEX ERP       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const ROUTES = Object.freeze({
  base: '/api/price-commissions',
  prices: '/api/price-commissions/prices',
  sellers: '/api/price-commissions/sellers'
});

export const dom = {};

const DOM_IDS = [
  'fQ',
  'fPrice',
  'fSeller',
  'fActive',
  'fDate',
  'btnSearch',
  'btnClear',
  'tbody',
  'modal',
  'form',
  'mTitle',
  'btnClose',
  'btnCancel',
  'btnDelete',
  'commission_id',
  'price_id',
  'seller_id',
  'commission_type',
  'percent_value',
  'fixed_value',
  'active',
  'valid_from',
  'valid_to'
];

export function refreshDom() {
  for (const id of DOM_IDS) {
    dom[id] = document.getElementById(id);
  }

  return dom;
}

export function assertRequiredDom() {
  const missing = DOM_IDS.filter((id) => !dom[id]);

  if (missing.length) {
    throw new Error(
      `Elementos HTML não encontrados: ${missing.join(', ')}.`
    );
  }
}


// ╔══════════════════════════════════════════════════════════════╗
// ║ budgets.priceMode.js — PRODUCT_PRICE_MODE no orçamento      ║
// ║ PRODNEX ERP | ESM                                           ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

import { $, ROUTES, state } from './budgets.core.js';
import { authHeaders, fetchSafe } from './budgets.infra.js';

export const SINGLE_PRICE_ID = 1;
export const PRICE_MODES = Object.freeze({ SINGLE: 'SINGLE', MULTIPLE: 'MULTIPLE' });

function normalizeMode(payload = {}) {
  const feature = payload?.feature ?? payload?.data?.feature ?? payload?.data ?? payload;
  const raw =
    feature?.optionCode ?? feature?.option_code ?? feature?.config?.mode ??
    feature?.config?.priceMode ?? feature?.default_value?.optionCode ??
    PRICE_MODES.MULTIPLE;

  return String(raw).trim().toUpperCase() === PRICE_MODES.SINGLE
    ? PRICE_MODES.SINGLE
    : PRICE_MODES.MULTIPLE;
}

export function isSinglePriceMode() {
  return state.priceMode?.mode === PRICE_MODES.SINGLE;
}

export function isMultiplePriceMode() {
  return !isSinglePriceMode();
}

export function applyPriceModeUI() {
  const field = $('#budgetPriceTableField');
  const select = $('#tabela');
  const single = isSinglePriceMode();

  if (field) {
    field.hidden = single;
    field.setAttribute('aria-hidden', single ? 'true' : 'false');
  }

  if (select && single) {
    select.innerHTML = '<option value="1">Preço único</option>';
    select.value = String(SINGLE_PRICE_ID);
    select.disabled = true;
  }
}

export function applyPriceModeToNewBudget() {
  if (!state.editing?.header || !isSinglePriceMode()) return;
  state.editing.header.price_id = SINGLE_PRICE_ID;
  state.editing.header.price_table_name = 'Preço único';
  applyPriceModeUI();
}

export async function initBudgetPriceMode() {
  let mode = PRICE_MODES.MULTIPLE;

  try {
    const out = await fetchSafe(ROUTES.productPriceMode, {
      method: 'GET',
      headers: authHeaders(),
      cache: 'no-store',
    });
    if (out.ok) mode = normalizeMode(out.json);
    else console.warn('[budgets][price-mode] Resolver indisponível; usando MULTIPLE.');
  } catch (error) {
    console.warn('[budgets][price-mode] Falha ao resolver:', error?.message || error);
  }

  state.priceMode = {
    mode,
    singlePriceId: SINGLE_PRICE_ID,
    allowMultiplePrices: mode === PRICE_MODES.MULTIPLE,
    loaded: true,
  };

  applyPriceModeUI();
  return state.priceMode;
}

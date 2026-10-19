// ╔══════════════════════════════════════════════════════════════╗
// ║ budgets.stockMode.js — PRODUCT_STOCK_MODE no orçamento      ║
// ║ PRODNEX ERP | ESM                                           ║
// ║ Fonte única: appFeatures -> products stock mode              ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

import {
  $,
  ROUTES,
  state,
  budgetSettings,
} from './budgets.core.js';

import {
  authHeaders,
  fetchSafe,
} from './budgets.infra.js';

export const STOCK_MODES = Object.freeze({
  SIMPLE: 'STOCK_SIMPLE',
  WITH_LOT: 'STOCK_WITH_LOT',
});

function normalizeStockMode(payload = {}) {
  const root =
    payload?.data?.data ??
    payload?.data ??
    payload ??
    {};

  const feature =
    root?.feature ??
    payload?.feature ??
    root;

  const optionCode = String(
    feature?.optionCode ??
    feature?.option_code ??
    root?.optionCode ??
    root?.option_code ??
    root?.mode ??
    root?.stockMode?.mode ??
    feature?.default_value?.optionCode ??
    '',
  )
    .trim()
    .toUpperCase();

  const managerMode = String(
    feature?.config?.managerMode ??
    feature?.config?.manager_mode ??
    root?.config?.managerMode ??
    root?.config?.manager_mode ??
    '',
  )
    .trim()
    .toLowerCase();

  const isSimple =
    optionCode === STOCK_MODES.SIMPLE ||
    optionCode === 'SIMPLE' ||
    managerMode === 'simple';

  return {
    mode: isSimple
      ? STOCK_MODES.SIMPLE
      : STOCK_MODES.WITH_LOT,

    isSimple,
    requireLot: !isSimple,
    allowLots: !isSimple,

    source:
      feature?.source ??
      root?.source ??
      'SAFE_DEFAULT',

    feature,
  };
}

function syncBudgetSettingsCompatibility() {
  // Compatibilidade com código legado. A autoridade NÃO é budgetSettings:
  // o valor abaixo é apenas um espelho de PRODUCT_STOCK_MODE.
  budgetSettings.require_stock_lot = requiresStockLot();
}

export function isSimpleStockMode() {
  return state.stockMode?.mode === STOCK_MODES.SIMPLE;
}

export function isStockWithLotMode() {
  return !isSimpleStockMode();
}

export function requiresStockLot() {
  return isStockWithLotMode();
}

export function applyStockModeUI() {
  const lotSelect = $('#lote');
  const simple = isSimpleStockMode();

  syncBudgetSettingsCompatibility();

  if (!lotSelect) return;

  lotSelect.dataset.stockMode = state.stockMode?.mode || '';

  if (simple) {
    lotSelect.innerHTML =
      '<option value="">Controle por lote desativado</option>';
    lotSelect.value = '';
    lotSelect.disabled = true;
    lotSelect.title =
      'Controle por lote desativado por PRODUCT_STOCK_MODE = STOCK_SIMPLE.';
    return;
  }

  // Não apagamos lotes já carregados. Quando ainda existe apenas o placeholder
  // do modo simples, restauramos o placeholder normal. A habilitação efetiva
  // continua sendo feita pela seleção do produto/grade em budgets.items.js.
  const onlySimplePlaceholder =
    lotSelect.options?.length === 1 &&
    String(lotSelect.options[0]?.textContent || '')
      .toLowerCase()
      .includes('controle por lote desativado');

  if (onlySimplePlaceholder) {
    lotSelect.innerHTML = '<option value="">Selecione...</option>';
  }

  lotSelect.title =
    'Controle por lote ativo por PRODUCT_STOCK_MODE = STOCK_WITH_LOT.';
}

export function applyStockModeToCurrentBudget() {
  syncBudgetSettingsCompatibility();

  if (!isSimpleStockMode()) {
    applyStockModeUI();
    return;
  }

  if (state.currentProduct) {
    state.currentProduct.lots = [];
  }

  const items = Array.isArray(state.editing?.items)
    ? state.editing.items
    : [];

  // Em STOCK_SIMPLE lot_id não faz parte da operação. Limpa somente a
  // alocação de lote; dados comerciais do item permanecem intactos.
  for (const item of items) {
    item.lot_id = null;
    item.lot_code = null;
    item.expiry_date = null;
    item.lot_expiration = null;
    item.qty_available_lot = null;
    item.available_lots = [];
    item.override_lot_id = null;
  }

  applyStockModeUI();
}

export async function initBudgetStockMode() {
  let resolved = normalizeStockMode(null);

  try {
    const separator = ROUTES.productStockMode.includes('?') ? '&' : '?';
    const url = `${ROUTES.productStockMode}${separator}_=${Date.now()}`;

    const out = await fetchSafe(url, {
      method: 'GET',
      headers: authHeaders(),
      cache: 'no-store',
    });

    if (out.ok) {
      resolved = normalizeStockMode(out.json);
    } else {
      console.warn(
        '[budgets][stock-mode] Resolver indisponível; usando STOCK_WITH_LOT como fallback seguro.',
      );
    }
  } catch (error) {
    console.warn(
      '[budgets][stock-mode] Falha ao resolver PRODUCT_STOCK_MODE; usando STOCK_WITH_LOT:',
      error?.message || error,
    );
  }

  state.stockMode = {
    ...resolved,
    loaded: true,
  };

  syncBudgetSettingsCompatibility();
  applyStockModeUI();

  console.log('[budgets][stock-mode] resolved=', {
    mode: state.stockMode.mode,
    requireLot: state.stockMode.requireLot,
    source: state.stockMode.source,
  });

  return state.stockMode;
}

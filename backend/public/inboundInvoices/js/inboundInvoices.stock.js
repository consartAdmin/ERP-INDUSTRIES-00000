/* ╔══════════════════════════════════════════════════════════════════╗
   ║ inboundInvoices.stock.js — PRODUCT_STOCK_MODE                   ║
   ║ PRODNEX ERP | Frontend (ESM)                                    ║
   ║ ✅ Fonte de verdade: appFeatures / PRODUCT_STOCK_MODE            ║
   ║ ✅ Safe default: STOCK_WITH_LOT                                  ║
   ║ ✅ STOCK_SIMPLE limpa lote/grade operacional                     ║
   ║ ✅ STOCK_WITH_LOT preserva o fluxo atual de lotes                ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

export const PRODUCT_STOCK_FEATURE_CODE = 'PRODUCT_STOCK_MODE';

export const PRODUCT_STOCK_MODES = Object.freeze({
  SIMPLE: 'STOCK_SIMPLE',
  WITH_LOT: 'STOCK_WITH_LOT',
});

const SAFE_DEFAULT_MODE = PRODUCT_STOCK_MODES.WITH_LOT;

function normalizeMode(value) {
  const mode = String(value ?? '').trim().toUpperCase();

  if (mode === 'STOCK_SIMPLE' || mode === 'SIMPLE') {
    return PRODUCT_STOCK_MODES.SIMPLE;
  }

  if (
    mode === 'STOCK_WITH_LOT' ||
    mode === 'WITH_LOT' ||
    mode === 'LOT' ||
    mode === 'LOTE'
  ) {
    return PRODUCT_STOCK_MODES.WITH_LOT;
  }

  return SAFE_DEFAULT_MODE;
}

function unwrapFeaturePayload(payload) {
  return (
    payload?.feature ??
    payload?.data?.feature ??
    payload?.data?.data?.feature ??
    payload?.data?.data ??
    payload?.data ??
    payload ??
    {}
  );
}

export function normalizeStockModeResponse(payload) {
  const feature = unwrapFeaturePayload(payload);

  const optionCode = String(
    feature?.optionCode ??
    feature?.option_code ??
    payload?.optionCode ??
    payload?.option_code ??
    feature?.mode ??
    payload?.mode ??
    ''
  ).trim().toUpperCase();

  const managerMode = String(
    feature?.config?.managerMode ??
    feature?.config?.manager_mode ??
    payload?.config?.managerMode ??
    payload?.config?.manager_mode ??
    ''
  ).trim().toLowerCase();

  const enabled = feature?.enabled !== false && payload?.enabled !== false;

  let mode = normalizeMode(optionCode);

  if (!optionCode && managerMode === 'simple') {
    mode = PRODUCT_STOCK_MODES.SIMPLE;
  } else if (!optionCode && ['with_lot', 'with-lot', 'lot'].includes(managerMode)) {
    mode = PRODUCT_STOCK_MODES.WITH_LOT;
  }

  // Mesmo princípio do backend: configuração inválida/desabilitada usa
  // o modo seguro com lote, nunca libera ajuste simples silenciosamente.
  if (!enabled) {
    mode = SAFE_DEFAULT_MODE;
  }

  const isSimple = mode === PRODUCT_STOCK_MODES.SIMPLE;

  return {
    featureCode: PRODUCT_STOCK_FEATURE_CODE,
    enabled,
    mode,
    isSimple,
    isWithLot: !isSimple,
    requireLot: !isSimple,
    allowLots: !isSimple,
    source:
      feature?.source ??
      payload?.source ??
      (optionCode ? 'APP_FEATURE' : 'SAFE_DEFAULT'),
    config: feature?.config ?? payload?.config ?? {},
    feature,
  };
}

export function getStockMode(state) {
  return normalizeMode(
    state?.stockMode ||
    state?.productStockMode ||
    state?.PRODUCT_STOCK_MODE ||
    SAFE_DEFAULT_MODE
  );
}

export function isSimpleStockMode(state) {
  return getStockMode(state) === PRODUCT_STOCK_MODES.SIMPLE;
}

export function isWithLotStockMode(state) {
  return !isSimpleStockMode(state);
}

export function clearItemLotState(item) {
  if (!item || typeof item !== 'object') return item;

  item.lot_id = null;
  item.lot_code = null;
  item.product_grade_id = null;
  item.grade_id = null;
  item._lots = [];
  item._grades = [];
  item._lotsLoadError = null;

  return item;
}

export function applyStockModeToItems(state, items = state?.currentItems) {
  if (!Array.isArray(items)) return [];

  if (isSimpleStockMode(state)) {
    items.forEach(clearItemLotState);
  }

  return items;
}

function applyResolvedModeToState(state, resolved) {
  if (!state || typeof state !== 'object') return resolved;

  state.stockMode = resolved.mode;
  state.productStockMode = resolved.mode;
  state.PRODUCT_STOCK_MODE = resolved.mode;

  state.stockModeResolved = true;
  state.stockModeResolutionError = null;
  state.stockModeInfo = resolved;

  applyStockModeToItems(state);

  // Qualquer cache de lotes carregado em outro modo deve ser descartado.
  state.lotsByProductCache?.clear?.();
  state.lotsByStockCache?.clear?.();
  state.gradesByProductCache?.clear?.();
  state.gradesByStockCache?.clear?.();

  return resolved;
}

function applySafeDefaultToState(state, error = null) {
  const resolved = normalizeStockModeResponse(null);

  if (state && typeof state === 'object') {
    state.stockMode = resolved.mode;
    state.productStockMode = resolved.mode;
    state.PRODUCT_STOCK_MODE = resolved.mode;
    state.stockModeResolved = false;
    state.stockModeResolutionError = error?.message || String(error || '');
    state.stockModeInfo = resolved;
  }

  return resolved;
}

export async function resolveInboundStockMode({ core, ROUTES, state } = {}) {
  const url = typeof ROUTES?.appFeatureResolve === 'function'
    ? ROUTES.appFeatureResolve(PRODUCT_STOCK_FEATURE_CODE)
    : `${core?.getBase?.() || ''}/api/app-features/${PRODUCT_STOCK_FEATURE_CODE}/resolve`;

  try {
    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'same-origin',
      cache: 'no-store',
    });

    let json = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }

    if (!response.ok) {
      const error = new Error(
        json?.error ||
        json?.message ||
        `Falha ao resolver ${PRODUCT_STOCK_FEATURE_CODE} (HTTP ${response.status}).`
      );
      error.status = response.status;
      throw error;
    }

    const resolved = normalizeStockModeResponse(json);
    applyResolvedModeToState(state, resolved);

    console.log('[INBOUND][PRODUCT_STOCK_MODE][RESOLVED]', {
      mode: resolved.mode,
      requireLot: resolved.requireLot,
      source: resolved.source,
    });

    return resolved;
  } catch (error) {
    const fallback = applySafeDefaultToState(state, error);

    console.warn(
      '[INBOUND][PRODUCT_STOCK_MODE][SAFE_DEFAULT]',
      error?.message || error,
      fallback,
    );

    return fallback;
  }
}

export async function initInboundStockMode(context = {}) {
  return resolveInboundStockMode(context);
}

export async function refreshInboundStockMode(context = {}) {
  const resolved = await resolveInboundStockMode(context);

  context?.state?.actions?.renderItemsTable?.(
    context?.state?.currentItems || [],
  );

  return resolved;
}

export default {
  PRODUCT_STOCK_FEATURE_CODE,
  PRODUCT_STOCK_MODES,
  normalizeStockModeResponse,
  getStockMode,
  isSimpleStockMode,
  isWithLotStockMode,
  clearItemLotState,
  applyStockModeToItems,
  resolveInboundStockMode,
  initInboundStockMode,
  refreshInboundStockMode,
};

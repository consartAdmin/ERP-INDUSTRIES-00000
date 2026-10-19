// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsPrices.manager.js — Regras do modo de preços dos produtos ║
// ║ CONSART ERP | Node.js ESM                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { resolveFeature } from '../appFeatures/appFeatures.index.js';
import * as productsPricesSingle from './productsPrices.single.js';
import * as productsPricesMultiple from './productsPrices.multiple.js';

export const PRODUCT_PRICE_FEATURE_CODE = 'PRODUCT_PRICE_MODE';

export const PRODUCT_PRICE_MODES = Object.freeze({
  SINGLE: 'SINGLE',
  MULTIPLE: 'MULTIPLE',
});

const DEFAULT_SCOPE_TYPE = 'GLOBAL';
const DEFAULT_SCOPE_ID = 1;
const SAFE_DEFAULT_MODE = PRODUCT_PRICE_MODES.MULTIPLE;

function normalizeScopeType(value) {
  const normalized = String(value ?? DEFAULT_SCOPE_TYPE)
    .trim()
    .toUpperCase();

  return normalized || DEFAULT_SCOPE_TYPE;
}

function normalizeScopeId(value) {
  const normalized = Number(value ?? DEFAULT_SCOPE_ID);

  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    const error = new Error('scopeId deve ser um inteiro positivo.');
    error.code = 'INVALID_PRODUCT_PRICE_SCOPE_ID';
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

export function normalizeProductsPricesMode(value) {
  const normalized = String(value ?? '').trim().toUpperCase();

  return Object.values(PRODUCT_PRICE_MODES).includes(normalized)
    ? normalized
    : SAFE_DEFAULT_MODE;
}

/**
 * Resolve a configuração atual sem cache.
 * Dessa forma, alterações em appFeatureAssignments têm efeito imediato.
 */
export async function resolveProductsPricesMode({
  scopeType = DEFAULT_SCOPE_TYPE,
  scopeId = DEFAULT_SCOPE_ID,
} = {}) {
  const normalizedScopeType = normalizeScopeType(scopeType);
  const normalizedScopeId = normalizeScopeId(scopeId);

  const feature = await resolveFeature({
    featureCode: PRODUCT_PRICE_FEATURE_CODE,
    scopeType: normalizedScopeType,
    scopeId: normalizedScopeId,
  });

  const configuredMode = normalizeProductsPricesMode(feature?.optionCode);
  const enabled = feature?.enabled !== false;
  const mode = enabled ? configuredMode : SAFE_DEFAULT_MODE;
  const allowMultiplePrices = mode === PRODUCT_PRICE_MODES.MULTIPLE;

  return {
    featureCode: PRODUCT_PRICE_FEATURE_CODE,
    enabled,
    mode,
    isSingle: mode === PRODUCT_PRICE_MODES.SINGLE,
    isMultiple: allowMultiplePrices,
    allowMultiplePrices,
    scopeType: normalizedScopeType,
    scopeId: normalizedScopeId,
    source: feature?.source ?? 'SAFE_DEFAULT',
    config: {
      ...(feature?.config ?? {}),
      managerMode: mode.toLowerCase(),
      allowMultiplePrices,
    },
    feature,
  };
}

function booleanValue(value) {
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 't', 'yes', 'y', 'on', 'sim'].includes(
    String(value ?? '').trim().toLowerCase(),
  );
}

function rowId(row = {}) {
  const candidates = [
    row.price_id,
    row.priceId,
    row.tabela_preco_id,
    row.product_price_id,
    row.productPriceId,
    row.id,
  ];

  return candidates.find((value) => value !== undefined && value !== null) ?? null;
}

function isDefaultRow(row = {}) {
  return booleanValue(
    row.is_default ??
      row.isDefault ??
      row.default_price ??
      row.defaultPrice ??
      row.price_is_default ??
      row.priceIsDefault,
  );
}

function isActiveRow(row = {}) {
  const value = row.is_active ?? row.isActive ?? row.active;
  return value === undefined || value === null ? true : booleanValue(value);
}

function numericOrder(row = {}) {
  const value = Number(
    row.sort_order ?? row.sortOrder ?? row.display_order ?? row.id ?? 0,
  );

  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

/**
 * Seleciona de forma determinística o preço usado no modo SINGLE.
 * Prioridade:
 * 1. defaultPriceId informado pelo chamador;
 * 2. linha marcada como padrão;
 * 3. primeira linha ativa pela ordenação;
 * 4. primeira linha disponível.
 */
export function selectSinglePrice(rows = [], { defaultPriceId = null } = {}) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!list.length) return null;

  if (defaultPriceId !== null && defaultPriceId !== undefined) {
    const selected = list.find(
      (row) => String(rowId(row)) === String(defaultPriceId),
    );
    if (selected) return selected;
  }

  const explicitDefault = list.find((row) => isDefaultRow(row));
  if (explicitDefault) return explicitDefault;

  const activeRows = list
    .filter((row) => isActiveRow(row))
    .sort((left, right) => numericOrder(left) - numericOrder(right));

  return activeRows[0] ?? list[0];
}

/**
 * Aplica o modo configurado a uma lista já carregada pela API.
 * Não altera os objetos e nunca exclui preços armazenados.
 */
export function applyProductsPricesMode(
  rows = [],
  modeConfig = {},
  { defaultPriceId = null } = {},
) {
  const list = Array.isArray(rows) ? rows : [];
  const mode = normalizeProductsPricesMode(modeConfig.mode);

  if (mode === PRODUCT_PRICE_MODES.MULTIPLE) {
    return [...list];
  }

  const selected = selectSinglePrice(list, { defaultPriceId });
  return selected ? [selected] : [];
}

/**
 * Proteção para POST/PUT: impede que o backend aceite vários preços
 * quando o modo SINGLE estiver ativo.
 */
export function assertProductsPricesPayloadAllowed(
  payload,
  modeConfig = {},
) {
  const mode = normalizeProductsPricesMode(modeConfig.mode);
  if (mode !== PRODUCT_PRICE_MODES.SINGLE) return true;

  const prices = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.prices)
      ? payload.prices
      : Array.isArray(payload?.rows)
        ? payload.rows
        : payload == null
          ? []
          : [payload];

  if (prices.filter(Boolean).length <= 1) return true;

  const error = new Error(
    'O modo de preço único permite somente um preço por produto.',
  );
  error.code = 'PRODUCT_PRICE_MODE_SINGLE';
  error.statusCode = 422;
  error.details = {
    featureCode: PRODUCT_PRICE_FEATURE_CODE,
    mode: PRODUCT_PRICE_MODES.SINGLE,
    receivedPrices: prices.filter(Boolean).length,
  };
  throw error;
}

/**
 * Helper completo para endpoints GET.
 */
export async function resolveAndApplyProductsPricesMode(
  rows = [],
  {
    scopeType = DEFAULT_SCOPE_TYPE,
    scopeId = DEFAULT_SCOPE_ID,
    defaultPriceId = null,
  } = {},
) {
  const modeConfig = await resolveProductsPricesMode({ scopeType, scopeId });
  const filteredRows = applyProductsPricesMode(rows, modeConfig, {
    defaultPriceId,
  });

  return {
    mode: modeConfig.mode,
    allowMultiplePrices: modeConfig.allowMultiplePrices,
    rows: filteredRows,
    total: filteredRows.length,
    originalTotal: Array.isArray(rows) ? rows.length : 0,
    feature: modeConfig,
  };
}

/**
 * Resolve a implementação responsável pelo CRUD.
 * SINGLE usa sempre a estratégia de preço único (price_id = 1).
 * MULTIPLE preserva o comportamento atual de múltiplas tabelas.
 */
export async function resolveProductsPricesStrategy(options = {}) {
  const modeConfig = await resolveProductsPricesMode(options);
  const strategy = modeConfig.isSingle
    ? productsPricesSingle
    : productsPricesMultiple;

  return { strategy, modeConfig };
}

function getStrategyMethod(strategy, methodName) {
  const method = strategy?.[methodName] ?? strategy?.default?.[methodName];

  if (typeof method !== 'function') {
    const error = new Error(
      `A estratégia de preços não implementa ${methodName}().`,
    );
    error.code = 'PRODUCT_PRICE_STRATEGY_METHOD_NOT_FOUND';
    error.statusCode = 500;
    throw error;
  }

  return method;
}

function withModeMetadata(result, modeConfig) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return result;
  }

  return {
    ...result,
    priceMode: {
      featureCode: modeConfig.featureCode,
      mode: modeConfig.mode,
      allowMultiplePrices: modeConfig.allowMultiplePrices,
      scopeType: modeConfig.scopeType,
      scopeId: modeConfig.scopeId,
      source: modeConfig.source,
    },
  };
}

/** Lista os preços conforme o modo configurado no appFeatures. */
export async function getPricesByProduct(productId, options = {}) {
  const { strategy, modeConfig } = await resolveProductsPricesStrategy(options);
  const method = getStrategyMethod(strategy, 'getPricesByProduct');
  const result = await method(productId);

  return withModeMetadata(result, modeConfig);
}

/** Cria ou atualiza preços conforme a estratégia ativa. */
export async function upsertProductPrices(productId, prices, options = {}) {
  const { strategy, modeConfig } = await resolveProductsPricesStrategy(options);
  assertProductsPricesPayloadAllowed(prices, modeConfig);

  const method = getStrategyMethod(strategy, 'upsertProductPrices');
  const result = await method(productId, prices);

  return withModeMetadata(result, modeConfig);
}

/** Atualiza um preço conforme a estratégia ativa. */
export async function updateProductPrice(
  productId,
  priceId,
  patch = {},
  options = {},
) {
  const { strategy, modeConfig } = await resolveProductsPricesStrategy(options);
  const method = getStrategyMethod(strategy, 'updateProductPrice');
  const result = await method(productId, priceId, patch);

  return withModeMetadata(result, modeConfig);
}

/** Remove um preço conforme a estratégia ativa. */
export async function deleteProductPrice(productId, priceId, options = {}) {
  const { strategy, modeConfig } = await resolveProductsPricesStrategy(options);
  const method = getStrategyMethod(strategy, 'deleteProductPrice');
  const result = await method(productId, priceId);

  return withModeMetadata(result, modeConfig);
}

export default {
  PRODUCT_PRICE_FEATURE_CODE,
  PRODUCT_PRICE_MODES,
  normalizeProductsPricesMode,
  resolveProductsPricesMode,
  selectSinglePrice,
  applyProductsPricesMode,
  assertProductsPricesPayloadAllowed,
  resolveAndApplyProductsPricesMode,
  resolveProductsPricesStrategy,
  getPricesByProduct,
  upsertProductPrices,
  updateProductPrice,
  deleteProductPrice,
};

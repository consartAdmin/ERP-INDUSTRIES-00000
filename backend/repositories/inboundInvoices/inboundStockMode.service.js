// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ inboundStockMode.service.js — CONSART ERP | Notas de Entrada            ║
// ║ Regra de negócio PRODUCT_STOCK_MODE para o backend do Inbound NF-e       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  resolveFeature,
} from '../appFeatures/appFeatures.index.js';

export const INBOUND_STOCK_FEATURE_CODE = 'PRODUCT_STOCK_MODE';

export const INBOUND_STOCK_MODES = Object.freeze({
  SIMPLE: 'STOCK_SIMPLE',
  WITH_LOT: 'STOCK_WITH_LOT',
});

function normalizeScopeId(value) {
  const n = Number(value ?? 1);
  return Number.isSafeInteger(n) && n > 0 ? n : 1;
}

function normalizeScopeType(value) {
  const s = String(value ?? 'GLOBAL').trim().toUpperCase();
  return s || 'GLOBAL';
}

export function getInboundFeatureScope(options = {}) {
  return {
    scopeType: normalizeScopeType(
      options.featureScopeType ??
      options.scopeType ??
      options.appFeatureScope?.scopeType ??
      'GLOBAL',
    ),
    scopeId: normalizeScopeId(
      options.featureScopeId ??
      options.scopeId ??
      options.appFeatureScope?.scopeId ??
      1,
    ),
  };
}

export async function resolveInboundStockMode(options = {}) {
  const scope = getInboundFeatureScope(options);

  const feature = await resolveFeature({
    featureCode: INBOUND_STOCK_FEATURE_CODE,
    scopeType: scope.scopeType,
    scopeId: scope.scopeId,
  });

  if (!feature) {
    const error = new Error(
      `[INBOUND] Feature ${INBOUND_STOCK_FEATURE_CODE} não cadastrada.`,
    );
    error.code = 'INBOUND_STOCK_MODE_FEATURE_NOT_FOUND';
    error.status = 500;
    error.statusCode = 500;
    throw error;
  }

  if (!feature.enabled) {
    const error = new Error(
      `[INBOUND] Feature ${INBOUND_STOCK_FEATURE_CODE} está desativada.`,
    );
    error.code = 'INBOUND_STOCK_MODE_FEATURE_DISABLED';
    error.status = 422;
    error.statusCode = 422;
    throw error;
  }

  const mode = String(feature.optionCode || '')
    .trim()
    .toUpperCase();

  const isSimple = mode === INBOUND_STOCK_MODES.SIMPLE;
  const isWithLot = mode === INBOUND_STOCK_MODES.WITH_LOT;

  if (!isSimple && !isWithLot) {
    const error = new Error(
      `[INBOUND] ${INBOUND_STOCK_FEATURE_CODE} inválido: "${mode}".`,
    );
    error.code = 'INBOUND_STOCK_MODE_INVALID';
    error.status = 500;
    error.statusCode = 500;
    error.details = {
      featureCode: INBOUND_STOCK_FEATURE_CODE,
      optionCode: feature.optionCode ?? null,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
    };
    throw error;
  }

  const requireLot = isWithLot || Boolean(
    feature.config?.requireLot ??
    feature.config?.require_lot ??
    false,
  );

  return {
    mode,
    isSimple,
    isWithLot,
    requireLot,
    scopeType: feature.scopeType ?? scope.scopeType,
    scopeId: feature.scopeId ?? scope.scopeId,
    source: feature.source ?? 'DEFAULT',
    config: feature.config ?? {},
    feature,
  };
}

export function normalizeInboundItemByStockMode(item = {}, stockMode = {}) {
  const normalized = { ...item };

  if (
    stockMode?.isSimple === true ||
    stockMode?.mode === INBOUND_STOCK_MODES.SIMPLE
  ) {
    normalized.lot_id = null;
    normalized.lotId = null;
    normalized.lote_id = null;
    normalized.loteId = null;
  }

  return normalized;
}

export function normalizeInboundItemsByStockMode(items = [], stockMode = {}) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => normalizeInboundItemByStockMode(item, stockMode));
}

export function validateInboundItemForPosting(item = {}, stockMode = {}) {
  const productCode = String(
    item?.product_code ??
    item?.productCode ??
    item?.sku ??
    '',
  ).trim();

  // Item ainda não vinculado ao cadastro de produtos não participa da
  // movimentação. A validação de vínculo continua pertencendo ao fluxo atual.
  if (!productCode) return { ok: true, skipped: true };

  const requireLot =
    stockMode?.requireLot === true ||
    stockMode?.mode === INBOUND_STOCK_MODES.WITH_LOT;

  if (!requireLot) return { ok: true };

  const rawLotId =
    item?.lot_id ??
    item?.lotId ??
    item?.lote_id ??
    item?.loteId ??
    null;

  const lotId = Number(rawLotId);

  if (!Number.isSafeInteger(lotId) || lotId <= 0) {
    return {
      ok: false,
      code: 'INBOUND_ITEM_LOT_REQUIRED',
      status: 400,
      productCode,
      message: `Não foi possível resolver um lote para o SKU ${productCode}.`,
    };
  }

  return { ok: true, lotId };
}

export function assertInboundItemsForPosting(items = [], stockMode = {}) {
  for (const item of Array.isArray(items) ? items : []) {
    const validation = validateInboundItemForPosting(item, stockMode);
    if (validation.ok) continue;

    const error = new Error(validation.message);
    error.code = validation.code;
    error.status = validation.status || 400;
    error.statusCode = error.status;
    error.details = {
      productCode: validation.productCode,
      stockMode: stockMode?.mode ?? null,
      requireLot: stockMode?.requireLot === true,
    };
    throw error;
  }

  return true;
}

export default {
  INBOUND_STOCK_FEATURE_CODE,
  INBOUND_STOCK_MODES,
  getInboundFeatureScope,
  resolveInboundStockMode,
  normalizeInboundItemByStockMode,
  normalizeInboundItemsByStockMode,
  validateInboundItemForPosting,
  assertInboundItemsForPosting,
};

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsStock.manager.js — Seletor do modo de estoque              ║
// ║ CONSART ERP | Node.js ESM                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { resolveFeature } from '../appFeatures/appFeatures.index.js';
import * as simpleStock from './productsStock.simple.js';
import * as lotStock from './productsStock.withLot.js';

export const PRODUCT_STOCK_FEATURE_CODE = 'PRODUCT_STOCK_MODE';

export const PRODUCT_STOCK_MODES = Object.freeze({
  WITH_LOT: 'STOCK_WITH_LOT',
  SIMPLE: 'STOCK_SIMPLE',
});

const DEFAULT_SCOPE_TYPE = 'GLOBAL';
const DEFAULT_SCOPE_ID = 1;
const SAFE_DEFAULT_MODE = PRODUCT_STOCK_MODES.WITH_LOT;

function normalizeScopeType(value) {
  return String(value ?? DEFAULT_SCOPE_TYPE).trim().toUpperCase() ||
    DEFAULT_SCOPE_TYPE;
}

function normalizeScopeId(value) {
  const normalized = Number(value ?? DEFAULT_SCOPE_ID);

  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    const error = new Error('scopeId deve ser um inteiro positivo.');
    error.code = 'INVALID_PRODUCT_STOCK_SCOPE_ID';
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

export function normalizeProductsStockMode(value) {
  const normalized = String(value ?? '').trim().toUpperCase();

  if (
    normalized === PRODUCT_STOCK_MODES.SIMPLE ||
    normalized === 'SIMPLE'
  ) {
    return PRODUCT_STOCK_MODES.SIMPLE;
  }

  if (
    normalized === PRODUCT_STOCK_MODES.WITH_LOT ||
    normalized === 'WITH_LOT'
  ) {
    return PRODUCT_STOCK_MODES.WITH_LOT;
  }

  return SAFE_DEFAULT_MODE;
}

/** Resolve a configuração atual sem cache. */
export async function resolveProductsStockMode({
  scopeType = DEFAULT_SCOPE_TYPE,
  scopeId = DEFAULT_SCOPE_ID,
} = {}) {
  const normalizedScopeType = normalizeScopeType(scopeType);
  const normalizedScopeId = normalizeScopeId(scopeId);

  const feature = await resolveFeature({
    featureCode: PRODUCT_STOCK_FEATURE_CODE,
    scopeType: normalizedScopeType,
    scopeId: normalizedScopeId,
  });

  const configuredMode = normalizeProductsStockMode(feature?.optionCode);
  const enabled = feature?.enabled !== false;
  const mode = enabled ? configuredMode : SAFE_DEFAULT_MODE;
  const requireLot = mode === PRODUCT_STOCK_MODES.WITH_LOT;

  return {
    featureCode: PRODUCT_STOCK_FEATURE_CODE,
    enabled,
    mode,
    isSimple: mode === PRODUCT_STOCK_MODES.SIMPLE,
    isWithLot: requireLot,
    requireLot,
    scopeType: normalizedScopeType,
    scopeId: normalizedScopeId,
    source: feature?.source ?? 'SAFE_DEFAULT',
    config: {
      ...(feature?.config ?? {}),
      managerMode: requireLot ? 'with_lot' : 'simple',
      requireLot,
    },
    feature,
  };
}

export async function resolveProductsStockStrategy(options = {}) {
  const modeConfig = await resolveProductsStockMode(options);

  return {
    modeConfig,
    strategy: modeConfig.isWithLot ? lotStock : simpleStock,
    masterStrategy: simpleStock,
  };
}

function modeError(message, code, modeConfig, statusCode = 422) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.status = statusCode;
  error.details = {
    featureCode: PRODUCT_STOCK_FEATURE_CODE,
    mode: modeConfig.mode,
    requireLot: modeConfig.requireLot,
  };
  return error;
}

async function requireLotMode(options = {}) {
  const modeConfig = await resolveProductsStockMode(options);

  if (!modeConfig.isWithLot) {
    throw modeError(
      'Esta operação exige controle de estoque por lote.',
      'PRODUCT_STOCK_LOT_MODE_REQUIRED',
      modeConfig,
    );
  }

  return modeConfig;
}

/** Cria as duas estruturas sem alterar o modo selecionado. */
export async function ensureTables() {
  await simpleStock.ensureTable();
  await lotStock.ensureProductsStockLotsTable();
  return { ok: true };
}

// Consultas do cadastro mestre são válidas nos dois modos.
export const list = (filters = {}) => simpleStock.list(filters);

export const listPurchaseSuggestion = (filters = {}) =>
  simpleStock.listPurchaseSuggestion(filters);

export const getById = (productStockId) => simpleStock.getById(productStockId);

export const getByProductCode = (productCode) =>
  simpleStock.getByProductCode(productCode);

export const filterOptions = () => simpleStock.filterOptions();

export async function create(payload = {}, options = {}) {
  const modeConfig = await resolveProductsStockMode(options);
  const stockQty = Number(payload.stock_qty ?? 0);

  if (modeConfig.isWithLot && Number.isFinite(stockQty) && stockQty !== 0) {
    throw modeError(
      'No modo com lote, o saldo inicial deve ser lançado em um lote.',
      'PRODUCT_STOCK_DIRECT_QUANTITY_BLOCKED',
      modeConfig,
    );
  }

  return simpleStock.create({
    ...payload,
    ...(modeConfig.isWithLot ? { stock_qty: 0 } : {}),
  });
}

export async function update(productStockId, payload = {}, options = {}) {
  const modeConfig = await resolveProductsStockMode(options);
  const changesStockQty = Object.prototype.hasOwnProperty.call(
    payload,
    'stock_qty',
  );

  if (modeConfig.isWithLot && changesStockQty) {
    throw modeError(
      'No modo com lote, stock_qty é calculado pelos lotes.',
      'PRODUCT_STOCK_DIRECT_QUANTITY_BLOCKED',
      modeConfig,
    );
  }

  return simpleStock.update(productStockId, payload);
}

export async function adjust(productStockId, delta, options = {}) {
  const modeConfig = await resolveProductsStockMode(options);

  if (modeConfig.isWithLot) {
    throw modeError(
      'No modo com lote, informe o lote que receberá a movimentação.',
      'PRODUCT_STOCK_LOT_REQUIRED',
      modeConfig,
    );
  }

  return simpleStock.adjust(productStockId, delta);
}

export const remove = (productStockId) => simpleStock.remove(productStockId);

// Operações exclusivas do modo com lote.
export async function recalcStockFromLots(
  productStockId,
  client = undefined,
  options = {},
) {
  await requireLotMode(options);
  return lotStock.recalcStockFromLots(productStockId, client);
}

export async function getStockQtyByProductStockId(
  productStockId,
  client = undefined,
  options = {},
) {
  await requireLotMode(options);
  return lotStock.getStockQtyByProductStockId(productStockId, client);
}

export async function resolveProductGradeId(
  payload,
  client = undefined,
  options = {},
) {
  await requireLotMode(options);
  return lotStock.resolveProductGradeId(payload, client);
}

export async function listLots(filters = {}, options = {}) {
  await requireLotMode(options);
  return lotStock.listLots(filters);
}

export async function listLotsFefo(
  productStockId,
  productGradeId = null,
  options = {},
) {
  await requireLotMode(options);
  return lotStock.listLotsFefo(productStockId, productGradeId);
}

export async function getLotById(lotId, options = {}) {
  await requireLotMode(options);
  return lotStock.getLotById(lotId);
}

export async function listLotsOptionsByStockId(
  productStockId,
  productGradeId = null,
  options = {},
) {
  await requireLotMode(options);
  return lotStock.listLotsOptionsByStockId(productStockId, productGradeId);
}

export async function upsertLot(payload, options = {}) {
  await requireLotMode(options);
  return lotStock.upsertLot(payload);
}

export async function updateLot(lotId, payload, options = {}) {
  await requireLotMode(options);
  return lotStock.updateLot(lotId, payload);
}

export async function removeLot(lotId, options = {}) {
  await requireLotMode(options);
  return lotStock.removeLot(lotId);
}

export async function reserveLot(payload, options = {}) {
  await requireLotMode(options);
  return lotStock.reserveLot(payload);
}

export async function unreserveLot(payload, options = {}) {
  await requireLotMode(options);
  return lotStock.unreserveLot(payload);
}

export async function consumeLot(payload, options = {}) {
  await requireLotMode(options);
  return lotStock.consumeLot(payload);
}

export async function listAvailableLotsByProduct(
  productStockId,
  productGradeId = null,
  options = {},
) {
  await requireLotMode(options);
  return lotStock.listAvailableLotsByProduct(
    productStockId,
    productGradeId,
  );
}

export async function getProductsStockLotsByProductCode(
  productCode,
  productGradeId = null,
  options = {},
) {
  await requireLotMode(options);
  return lotStock.getProductsStockLotsByProductCode(
    productCode,
    productGradeId,
  );
}

export default {
  PRODUCT_STOCK_FEATURE_CODE,
  PRODUCT_STOCK_MODES,
  normalizeProductsStockMode,
  resolveProductsStockMode,
  resolveProductsStockStrategy,
  ensureTables,
  list,
  listPurchaseSuggestion,
  getById,
  getByProductCode,
  create,
  update,
  adjust,
  remove,
  filterOptions,
  recalcStockFromLots,
  getStockQtyByProductStockId,
  resolveProductGradeId,
  listLots,
  listLotsFefo,
  getLotById,
  listLotsOptionsByStockId,
  upsertLot,
  updateLot,
  removeLot,
  reserveLot,
  unreserveLot,
  consumeLot,
  listAvailableLotsByProduct,
  getProductsStockLotsByProductCode,
};

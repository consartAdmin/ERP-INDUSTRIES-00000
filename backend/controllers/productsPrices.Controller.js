// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsPrices.controller.js — Product prices HTTP controller      ║
// ║ CONSART ERP | Node.js ESM                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import productsPricesManager from '../repositories/productsPrices/productsPrices.manager.js';

const DEFAULT_SCOPE_TYPE = 'GLOBAL';
const DEFAULT_SCOPE_ID = 1;

function normalizeProductId(value) {
  return String(value ?? '').trim();
}

function getScopeOptions(req) {
  return {
    scopeType:
      req.appFeatureScope?.scopeType ??
      req.user?.scopeType ??
      DEFAULT_SCOPE_TYPE,
    scopeId:
      req.appFeatureScope?.scopeId ??
      req.user?.scopeId ??
      DEFAULT_SCOPE_ID,
  };
}

function errorStatus(result, fallback = 400) {
  if (Number.isInteger(result?.statusCode)) return result.statusCode;

  const message = String(result?.error ?? '').toLowerCase();
  if (message.includes('not found')) return 404;
  if (message.includes('failed')) return 500;
  return fallback;
}

function sendResult(res, result, successStatus = 200) {
  if (!result?.ok) {
    return res.status(errorStatus(result)).json(
      result ?? { ok: false, error: 'Unexpected product price response.' },
    );
  }

  return res.status(successStatus).json(result);
}

function sendControllerError(res, error, operation) {
  console.error(`[productsPrices.controller:${operation}] error:`, error);

  const status = Number.isInteger(error?.statusCode)
    ? error.statusCode
    : 500;

  return res.status(status).json({
    ok: false,
    error: error?.code ?? 'PRODUCT_PRICE_INTERNAL_ERROR',
    message: error?.message ?? 'Unexpected product price error.',
    ...(error?.details ? { details: error.details } : {}),
  });
}

/** GET /api/products/:productId/prices */
export async function listByProduct(req, res) {
  const productId = normalizeProductId(req.params.productId);
  if (!productId) {
    return res.status(400).json({
      ok: false,
      error: 'productId is required.',
    });
  }

  try {
    const result = await productsPricesManager.getPricesByProduct(
      productId,
      getScopeOptions(req),
    );

    return sendResult(res, result);
  } catch (error) {
    return sendControllerError(res, error, 'listByProduct');
  }
}

/**
 * POST /api/products/:productId/prices
 * Body: { prices: [{ price_id, sale_price, markup_percent, gross_profit_pct }] }
 */
export async function upsertBulk(req, res) {
  const productId = normalizeProductId(req.params.productId);
  const prices = Array.isArray(req.body?.prices) ? req.body.prices : [];

  if (!productId) {
    return res.status(400).json({
      ok: false,
      error: 'productId is required.',
    });
  }

  if (!prices.length) {
    return res.status(400).json({
      ok: false,
      error: 'Body.prices must be a non-empty array.',
    });
  }

  try {
    const result = await productsPricesManager.upsertProductPrices(
      productId,
      prices,
      getScopeOptions(req),
    );

    return sendResult(res, result, 201);
  } catch (error) {
    return sendControllerError(res, error, 'upsertBulk');
  }
}

/** PUT /api/products/:productId/prices/:priceId */
export async function updateOne(req, res) {
  const productId = normalizeProductId(req.params.productId);
  const priceId = Number(req.params.priceId);

  if (!productId || !Number.isInteger(priceId)) {
    return res.status(400).json({
      ok: false,
      error: 'productId and priceId are required.',
    });
  }

  try {
    const result = await productsPricesManager.updateProductPrice(
      productId,
      priceId,
      req.body ?? {},
      getScopeOptions(req),
    );

    return sendResult(res, result);
  } catch (error) {
    return sendControllerError(res, error, 'updateOne');
  }
}

/** DELETE /api/products/:productId/prices/:priceId */
export async function removeOne(req, res) {
  const productId = normalizeProductId(req.params.productId);
  const priceId = Number(req.params.priceId);

  if (!productId || !Number.isInteger(priceId)) {
    return res.status(400).json({
      ok: false,
      error: 'productId and priceId are required.',
    });
  }

  try {
    const result = await productsPricesManager.deleteProductPrice(
      productId,
      priceId,
      getScopeOptions(req),
    );

    return sendResult(res, result);
  } catch (error) {
    return sendControllerError(res, error, 'removeOne');
  }
}

const ProductsPricesController = {
  listByProduct,
  upsertBulk,
  updateOne,
  removeOne,
};

export default ProductsPricesController;

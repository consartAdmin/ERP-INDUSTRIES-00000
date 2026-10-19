// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsStockLotsController.js — Controller (CONSART ERP | ESM)     ║
// ║ API: /api/productsStockLots                                         ║
// ║ Usa PRODUCT_STOCK_MODE para liberar ou bloquear operações com lote  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import productsStockManager from '../repositories/productsStock/productsStock.manager.js';

const DEFAULT_SCOPE_TYPE = 'GLOBAL';
const DEFAULT_SCOPE_ID = 1;

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

function toNum(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toNullableNum(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) && number > 0
    ? number
    : null;
}

function getProductGradeId(req) {
  return toNullableNum(
    req.query.product_grade_id ??
    req.query.productGradeId ??
    req.query.grade_id ??
    req.params.product_grade_id ??
    req.params.productGradeId ??
    req.params.grade_id ??
    null,
  );
}

function httpStatus(error, fallback = 400) {
  const status = Number(
    error?.statusCode ??
    error?.status,
  );

  return Number.isFinite(status) && status >= 100
    ? status
    : fallback;
}

function friendlyError(error) {
  if (error?.code === 'PRODUCT_STOCK_LOT_MODE_REQUIRED') {
    return {
      error: error.code,
      message: error.message,
      details: error.details || null,
    };
  }

  if (error?.message === 'BLOCKED_NO_POSITIVE_STOCK') {
    return {
      error: 'BLOCKED_NO_POSITIVE_STOCK',
      message:
        'Operação bloqueada: só é permitido movimentar lote quando o produto possui estoque positivo.',
      details: error?.details || null,
    };
  }

  if (error?.message === 'LOT_NOT_FOUND') {
    return {
      error: 'LOT_NOT_FOUND',
      message: 'Lote não encontrado.',
    };
  }

  return {
    error:
      error?.code ||
      'PRODUCT_STOCK_LOT_OPERATION_FAILED',

    message:
      error?.message ||
      'Falha na operação de estoque por lote.',

    ...(error?.details
      ? { details: error.details }
      : {}),
  };
}

function sendError(
  res,
  error,
  operation,
  fallbackStatus = 500,
) {
  console.error(
    `[productsStockLotsController:${operation}] error:`,
    error,
  );

  return res
    .status(httpStatus(error, fallbackStatus))
    .json({
      ok: false,
      ...friendlyError(error),
    });
}

/**
 * Inicializa as tabelas:
 * - productsStock
 * - productsStockLots
 */
export async function ensure(req, res) {
  try {
    await productsStockManager.ensureTables();

    return res.json({
      ok: true,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'ensure',
      500,
    );
  }
}

/**
 * GET /api/productsStockLots
 */
export async function list(req, res) {
  try {
    const data = await productsStockManager.listLots(
      {
        product_stock_id:
          req.query.product_stock_id
            ? Number(req.query.product_stock_id)
            : undefined,

        product_grade_id:
          req.query.product_grade_id !== undefined
            ? getProductGradeId(req)
            : undefined,

        q: req.query.q || '',

        onlyAvailable:
          String(
            req.query.onlyAvailable || '',
          ).toLowerCase() === 'true',

        page: toNum(
          req.query.page,
          1,
        ),

        limit: toNum(
          req.query.limit,
          20,
        ),

        orderBy:
          req.query.orderBy ||
          'expires_at',

        dir:
          req.query.dir ||
          'asc',
      },
      getScopeOptions(req),
    );

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'list',
      500,
    );
  }
}

/**
 * GET /api/productsStockLots/fefo/:product_stock_id
 */
export async function fefo(req, res) {
  try {
    const productStockId = Number(
      req.params.product_stock_id ??
      req.query.product_stock_id,
    );

    const productGradeId =
      getProductGradeId(req);

    if (!productStockId) {
      return res.status(400).json({
        ok: false,
        error:
          'PRODUCT_STOCK_ID_REQUIRED',
        message:
          'product_stock_id is required',
      });
    }

    const rows =
      await productsStockManager.listLotsFefo(
        productStockId,
        productGradeId,
        getScopeOptions(req),
      );

    return res.json({
      ok: true,
      rows,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'fefo',
      500,
    );
  }
}

/**
 * GET /api/productsStockLots/:id
 */
export async function getById(req, res) {
  try {
    const lotId = Number(
      req.params.id,
    );

    if (!lotId) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_LOT_ID',
        message: 'lot_id inválido.',
      });
    }

    const row =
      await productsStockManager.getLotById(
        lotId,
        getScopeOptions(req),
      );

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'LOT_NOT_FOUND',
        message: 'Lote não encontrado.',
      });
    }

    return res.json({
      ok: true,
      row,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'getById',
      500,
    );
  }
}

/**
 * POST /api/productsStockLots
 */
export async function createOrAdd(
  req,
  res,
) {
  try {
    const payload = {
      product_stock_id: Number(
        req.body.product_stock_id,
      ),

      product_grade_id:
        toNullableNum(
          req.body.product_grade_id ??
          req.body.productGradeId ??
          req.body.grade_id,
        ),

      lot_code: String(
        req.body.lot_code || '',
      ).trim(),

      expires_at:
        req.body.expires_at ||
        null,

      qty_on_hand:
        toNum(
          req.body.qty_on_hand,
          0,
        ),

      cost_unit:
        req.body.cost_unit ??
        null,

      supplier_id:
        req.body.supplier_id
          ? Number(req.body.supplier_id)
          : null,

      nfe_key:
        req.body.nfe_key ||
        null,

      nfe_item_seq:
        req.body.nfe_item_seq
          ? Number(req.body.nfe_item_seq)
          : null,
    };

    if (!payload.product_stock_id) {
      return res.status(400).json({
        ok: false,
        error:
          'PRODUCT_STOCK_ID_REQUIRED',
        message:
          'product_stock_id is required',
      });
    }

    if (!payload.lot_code) {
      return res.status(400).json({
        ok: false,
        error:
          'LOT_CODE_REQUIRED',
        message:
          'lot_code is required',
      });
    }

    const row =
      await productsStockManager.upsertLot(
        payload,
        getScopeOptions(req),
      );

    return res.status(201).json({
      ok: true,
      row,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'createOrAdd',
      400,
    );
  }
}

/**
 * PUT /api/productsStockLots/:id
 */
export async function update(req, res) {
  try {
    const lotId = Number(
      req.params.id,
    );

    if (!lotId) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_LOT_ID',
        message: 'lot_id inválido.',
      });
    }

    const body = {
      ...(req.body || {}),
    };

    const hasProductGrade =
      Object.prototype.hasOwnProperty.call(
        body,
        'product_grade_id',
      ) ||
      Object.prototype.hasOwnProperty.call(
        body,
        'productGradeId',
      ) ||
      Object.prototype.hasOwnProperty.call(
        body,
        'grade_id',
      );

    if (hasProductGrade) {
      body.product_grade_id =
        toNullableNum(
          body.product_grade_id ??
          body.productGradeId ??
          body.grade_id,
        );

      delete body.productGradeId;
      delete body.grade_id;
    }

    const row =
      await productsStockManager.updateLot(
        lotId,
        body,
        getScopeOptions(req),
      );

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'LOT_NOT_FOUND',
        message: 'Lote não encontrado.',
      });
    }

    return res.json({
      ok: true,
      row,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'update',
      400,
    );
  }
}

/**
 * DELETE /api/productsStockLots/:id
 */
export async function remove(req, res) {
  try {
    const lotId = Number(
      req.params.id,
    );

    if (!lotId) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_LOT_ID',
        message: 'lot_id inválido.',
      });
    }

    const result =
      await productsStockManager.removeLot(
        lotId,
        getScopeOptions(req),
      );

    return res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'remove',
      500,
    );
  }
}

/**
 * POST /api/productsStockLots/:id/reserve
 */
export async function reserve(req, res) {
  try {
    const lotId = Number(
      req.params.id,
    );

    const qty = toNum(
      req.body.qty,
      0,
    );

    const row =
      await productsStockManager.reserveLot(
        {
          lot_id: lotId,
          qty,
        },
        getScopeOptions(req),
      );

    return res.json({
      ok: true,
      row,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'reserve',
      400,
    );
  }
}

/**
 * POST /api/productsStockLots/:id/unreserve
 */
export async function unreserve(
  req,
  res,
) {
  try {
    const lotId = Number(
      req.params.id,
    );

    const qty = toNum(
      req.body.qty,
      0,
    );

    const row =
      await productsStockManager.unreserveLot(
        {
          lot_id: lotId,
          qty,
        },
        getScopeOptions(req),
      );

    return res.json({
      ok: true,
      row,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'unreserve',
      400,
    );
  }
}

/**
 * POST /api/productsStockLots/:id/consume
 */
export async function consume(req, res) {
  try {
    const lotId = Number(
      req.params.id,
    );

    const qty = toNum(
      req.body.qty,
      0,
    );

    const row =
      await productsStockManager.consumeLot(
        {
          lot_id: lotId,
          qty,
        },
        getScopeOptions(req),
      );

    return res.json({
      ok: true,
      row,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'consume',
      400,
    );
  }
}

/**
 * GET /api/productsStockLots/available/:product_stock_id
 */
export async function listAvailableByProduct(
  req,
  res,
) {
  try {
    const productStockId = Number(
      req.params.product_stock_id ??
      req.query.product_stock_id,
    );

    const productGradeId =
      getProductGradeId(req);

    if (!productStockId) {
      return res.status(400).json({
        ok: false,
        error:
          'PRODUCT_STOCK_ID_REQUIRED',
        message:
          'product_stock_id is required',
      });
    }

    const rows =
      await productsStockManager
        .listAvailableLotsByProduct(
          productStockId,
          productGradeId,
          getScopeOptions(req),
        );

    return res.json({
      ok: true,
      rows,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'listAvailableByProduct',
      500,
    );
  }
}

/**
 * GET /api/productsStockLots/available
 */
export async function available(req, res) {
  try {
    const raw =
      req.query.product_stock_id ??
      req.params.product_stock_id ??
      req.params.id;

    const productStockId = Number(raw);

    const productGradeId =
      getProductGradeId(req);

    if (
      !Number.isFinite(productStockId) ||
      productStockId <= 0
    ) {
      return res.status(400).json({
        ok: false,
        error:
          'PRODUCT_STOCK_ID_REQUIRED',
        message:
          'product_stock_id is required',
        details: {
          received: raw ?? null,
        },
      });
    }

    const rows =
      await productsStockManager
        .listAvailableLotsByProduct(
          productStockId,
          productGradeId,
          getScopeOptions(req),
        );

    return res.json({
      ok: true,
      rows,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'available',
      500,
    );
  }
}

/**
 * GET /api/productsStockLots/options
 */
export async function options(req, res) {
  try {
    const raw =
      req.query.product_stock_id ??
      req.params.product_stock_id ??
      req.params.id;

    const productStockId = Number(raw);

    const productGradeId =
      getProductGradeId(req);

    if (
      !Number.isFinite(productStockId) ||
      productStockId <= 0
    ) {
      return res.status(400).json({
        ok: false,
        error:
          'PRODUCT_STOCK_ID_REQUIRED',
        message:
          'product_stock_id is required',
        details: {
          received: raw ?? null,
        },
      });
    }

    const rows =
      await productsStockManager
        .listLotsOptionsByStockId(
          productStockId,
          productGradeId,
          getScopeOptions(req),
        );

    return res.json({
      ok: true,
      rows,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'options',
      500,
    );
  }
}

/**
 * GET /api/productsStockLots/product/:product_code
 */
export async function listByProductCode(
  req,
  res,
) {
  try {
    const productCode = String(
      req.params.product_code || '',
    ).trim();

    const productGradeId =
      getProductGradeId(req);

    if (!productCode) {
      return res.status(400).json({
        ok: false,
        error:
          'PRODUCT_CODE_REQUIRED',
        message:
          'product_code is required',
      });
    }

    const rows =
      await productsStockManager
        .getProductsStockLotsByProductCode(
          productCode,
          productGradeId,
          getScopeOptions(req),
        );

    return res.json({
      ok: true,
      rows,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'listByProductCode',
      500,
    );
  }
}

export default {
  ensure,
  list,
  fefo,
  getById,
  createOrAdd,
  update,
  remove,
  reserve,
  unreserve,
  consume,
  listAvailableByProduct,
  available,
  options,
  listByProductCode,
};
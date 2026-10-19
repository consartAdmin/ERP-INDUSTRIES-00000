// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalV2Controller.js — Express Controller (ESM)                ║
// ╚═════════════════════════════════════════════════════════════════════════╝

import * as svc from '../repositories/productsFiscalV2/productsFiscalV2.index.js';

// ============================================================================
// HELPERS
// ============================================================================

const bool = (value) => {
  if (value === undefined) return undefined;

  return ['true', '1'].includes(
    String(value).toLowerCase()
  );
};

function page(query) {
  return {
    limit: Math.min(
      Math.max(Number(query.limit) || 100, 1),
      500
    ),

    offset: Math.max(
      Number(query.offset) || 0,
      0
    ),
  };
}

function disableCache(res) {
  res.set({
    'Cache-Control':
      'no-store, no-cache, must-revalidate, proxy-revalidate',

    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  });
}

function sendError(res, error) {
  const status =
    error.code === '23503'
      ? 422
      : error.code === '23505'
        ? 409
        : error.status || 500;

  return res.status(status).json({
    ok: false,
    code: 'PRODUCTS_FISCAL_ERROR',
    message:
      error.message ||
      'Ocorreu um erro ao processar os dados fiscais do produto.',
  });
}

function validateClassificationId(value) {
  const id = Number(value);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

function normalizeProductCode(value) {
  return String(value || '').trim();
}

// ============================================================================
// LISTAR VÍNCULOS
// ============================================================================

export async function list(req, res) {
  try {
    const data = await svc.list({
      productCode:
        req.query.product_code ||
        req.query.sku,

      current: bool(req.query.current),
      active: bool(req.query.active),

      ...page(req.query),
    });

    disableCache(res);

    return res.status(200).json({
      ok: true,
      data,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

// ============================================================================
// LISTAR PRODUTOS PARA VÍNCULO EM LOTE
// ============================================================================

export async function batchList(req, res) {
  try {
    const search = String(
      req.query.q ||
      req.query.search ||
      ''
    ).trim();

    const data = await svc.listBatchProducts({
      search,
      linked: bool(req.query.linked),
      ...page(req.query),
    });

    disableCache(res);

    return res.status(200).json({
      ok: true,
      rows: data.rows,
      total: data.total,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

// ============================================================================
// CONSULTAR VÍNCULO ATUAL
// ============================================================================

export async function getCurrent(req, res) {
  try {
    const productCode = normalizeProductCode(
      req.params.productCode
    );

    if (!productCode) {
      return res.status(400).json({
        ok: false,
        code: 'PRODUCT_CODE_REQUIRED',
        message:
          'O código do produto é obrigatório.',
      });
    }

    const data = await svc.getCurrent(productCode);

    disableCache(res);

    return res.status(200).json({
      ok: true,
      hasFiscal: Boolean(data),
      fiscal: data,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

// ============================================================================
// CRIAR OU ATUALIZAR VÍNCULO ATUAL
// ============================================================================

export async function upsertCurrent(req, res) {
  try {
    const productCode = normalizeProductCode(
      req.body.product_code
    );

    const fiscalClassificationId =
      validateClassificationId(
        req.body.fiscal_classification_id
      );

    if (!productCode) {
      return res.status(400).json({
        ok: false,
        code: 'PRODUCT_CODE_REQUIRED',
        message:
          'O código do produto é obrigatório.',
      });
    }

    if (!fiscalClassificationId) {
      return res.status(400).json({
        ok: false,
        code: 'CLASSIFICATION_ID_REQUIRED',
        message:
          'Uma classificação fiscal válida é obrigatória.',
      });
    }

    const data = await svc.upsertCurrent({
      ...req.body,

      product_code:
        productCode,

      fiscal_classification_id:
        fiscalClassificationId,
    });

    return res.status(201).json({
      ok: true,
      data,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

// ============================================================================
// CRIAR OU ATUALIZAR VÍNCULOS EM LOTE
// ============================================================================

export async function batchUpsertCurrent(req, res) {
  const startedAt = Date.now();

  const requestId =
    req.headers['x-request-id'] ||
    null;

  /*
   * Confirma se o Express encerrou ou interrompeu
   * efetivamente a resposta HTTP.
   */
  res.once('finish', () => {
    console.info(
      '[ProductsFiscalV2Controller] Resposta HTTP finalizada.',
      {
        request_id: requestId,
        status: res.statusCode,
        headers_sent: res.headersSent,
        duration_ms:
          Date.now() - startedAt,
      }
    );
  });

  res.once('close', () => {
    console.info(
      '[ProductsFiscalV2Controller] Conexão HTTP encerrada.',
      {
        request_id: requestId,
        status: res.statusCode,
        headers_sent: res.headersSent,
        writable_ended: res.writableEnded,
        duration_ms:
          Date.now() - startedAt,
      }
    );
  });

  try {
    const productCodes =
      Array.isArray(req.body.product_codes)
        ? [
          ...new Set(
            req.body.product_codes
              .map(normalizeProductCode)
              .filter(Boolean)
          ),
        ]
        : [];

    const fiscalClassificationId =
      validateClassificationId(
        req.body.fiscal_classification_id
      );

    const context = {
      request_id:
        requestId,

      product_count:
        productCodes.length,

      product_codes:
        productCodes,

      fiscal_classification_id:
        fiscalClassificationId,

      source_system:
        req.body.source_system ||
        'productsFiscalBatch',
    };

    console.info(
      '[ProductsFiscalV2Controller] Requisição de vínculo em lote recebida.',
      context
    );

    if (!productCodes.length) {
      console.warn(
        '[ProductsFiscalV2Controller] Nenhum produto informado.',
        context
      );

      return res.status(400).json({
        ok: false,
        code: 'PRODUCT_CODES_REQUIRED',
        message:
          'Informe pelo menos um código de produto.',
        request_id: requestId,
      });
    }

    if (!fiscalClassificationId) {
      console.warn(
        '[ProductsFiscalV2Controller] Classificação fiscal inválida.',
        context
      );

      return res.status(400).json({
        ok: false,
        code: 'CLASSIFICATION_ID_REQUIRED',
        message:
          'Uma classificação fiscal válida é obrigatória.',
        request_id: requestId,
      });
    }

    console.info(
      '[ProductsFiscalV2Controller] Chamando service de vínculo em lote.',
      context
    );

    const data =
      await svc.batchUpsertCurrent({
        productCodes,

        fiscal_classification_id:
          fiscalClassificationId,

        source_system:
          req.body.source_system ||
          'productsFiscalBatch',

        source_reference:
          req.body.source_reference ||
          null,

        extra_payload:
          req.body.extra_payload ||
          {},
      });

    console.info(
      '[ProductsFiscalV2Controller] Service retornou com sucesso.',
      {
        ...context,

        returned_count:
          Array.isArray(data)
            ? data.length
            : null,

        duration_ms:
          Date.now() - startedAt,
      }
    );

    const responseBody = {
      ok: true,

      count:
        Array.isArray(data)
          ? data.length
          : 0,

      data,

      request_id:
        requestId,

      duration_ms:
        Date.now() - startedAt,
    };

    disableCache(res);

    console.info(
      '[ProductsFiscalV2Controller] Enviando resposta HTTP 201.',
      {
        ...context,
        response_count:
          responseBody.count,
        duration_ms:
          responseBody.duration_ms,
      }
    );

    return res
      .status(201)
      .json(responseBody);
  } catch (error) {
    console.error(
      '[ProductsFiscalV2Controller] Erro no vínculo fiscal em lote.',
      {
        request_id:
          requestId,

        message:
          error.message,

        code:
          error.code,

        failed_product_code:
          error.failed_product_code ||
          null,

        product_position:
          error.product_position ||
          null,

        product_count:
          error.product_count ||
          null,

        processed_product_codes:
          error.processed_product_codes ||
          [],

        database:
          error.database ||
          null,

        duration_ms:
          Date.now() - startedAt,

        stack:
          error.stack,
      }
    );

    return sendError(res, error);
  }
}

// ============================================================================
// ENCERRAR VÍNCULO ATUAL
// ============================================================================

export async function closeCurrent(req, res) {
  try {
    const productCode = normalizeProductCode(
      req.params.productCode
    );

    if (!productCode) {
      return res.status(400).json({
        ok: false,
        code: 'PRODUCT_CODE_REQUIRED',
        message:
          'O código do produto é obrigatório.',
      });
    }

    const data = await svc.closeCurrent(productCode);

    if (!data) {
      return res.status(404).json({
        ok: false,
        code: 'CURRENT_FISCAL_NOT_FOUND',
        message:
          'Nenhum vínculo fiscal atual foi encontrado.',
      });
    }

    return res.status(200).json({
      ok: true,
      data,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
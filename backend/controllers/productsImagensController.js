// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsImagensController.js                                  ║
// ║ MODULE: Controller de Imagens de Produtos                           ║
// ║ CONSART ERP                                                         ║
// ║ ESM | Express Controller                                            ║
// ║                                                                      ║
// ║ ✅ Tabela real: public."productsImages" (chave: product_code)       ║
// ║ ✅ Listagem por SKU (/by-code/:productCode) ou product_id (legado)  ║
// ║ ✅ Definição de imagem principal                                     ║
// ║ ✅ Reordenação de imagens                                            ║
// ║ ✅ Soft delete / hard delete opcional                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import productsImagensApi from '../repositories/productsImagens/productsImagens.index.js';

/* =========================================================================
   Helpers
   ========================================================================= */

const UNIT_IMAGE_PATH_CONSTRAINT = 'uq_productsimages_unit_image_path';

function toInt(value, fallback = null) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return fallback;

  const v = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on', 'sim'].includes(v)) return true;
  if (['false', '0', 'no', 'n', 'off', 'nao', 'não'].includes(v)) return false;

  return fallback;
}

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function buildErrorMessage(error, fallback = 'Erro interno do servidor.') {
  return error?.message || fallback;
}

function sendBadRequest(res, message, details = null) {
  return res.status(400).json({
    ok: false,
    error: message,
    ...(details ? { details } : {})
  });
}

function sendNotFound(res, message = 'Registro não encontrado.') {
  return res.status(404).json({
    ok: false,
    error: message
  });
}

function sendSuccess(res, data = null, message = null, status = 200, extra = {}) {
  return res.status(status).json({
    ok: true,
    ...(message ? { message } : {}),
    ...(data !== null ? { data } : {}),
    ...extra
  });
}

function isDuplicateConstraintError(error, constraintName) {
  return (
    String(error?.code || '') === '23505' &&
    String(error?.constraint || '').toLowerCase() === String(constraintName).toLowerCase()
  );
}

// Aceita :productCode (SKU) ou :productId (legado, resolvido via products).
async function resolveCodeFromParams(req) {
  if (req.params.productCode !== undefined) {
    return normalizeString(req.params.productCode);
  }
  const productId = toInt(req.params.productId);
  if (!productId || productId <= 0) return null;
  return productsImagensApi.resolveProductCode(productId);
}

/* =========================================================================
   GET /api/products-imagens
   Lista todas
   Query:
   - onlyActive=true|false
   ========================================================================= */

export async function listAllProductsImagens(req, res) {
  try {
    const onlyActive = toBool(req.query.onlyActive, true);

    const rows = await productsImagensApi.listAll({ onlyActive });

    return sendSuccess(res, rows, null, 200, {
      total: rows.length,
      filters: { onlyActive }
    });
  } catch (error) {
    console.error('[productsImagensController.listAllProductsImagens] erro:', error);
    return res.status(500).json({
      ok: false,
      error: buildErrorMessage(error, 'Falha ao listar imagens.')
    });
  }
}

/* =========================================================================
   GET /api/products-imagens/by-code/:productCode
   GET /api/products-imagens/product/:productId   (legado)
   Lista por produto
   Query:
   - onlyActive=true|false
   ========================================================================= */

export async function listProductsImagensByProduct(req, res) {
  try {
    const onlyActive = toBool(req.query.onlyActive, true);
    const productCode = await resolveCodeFromParams(req);

    if (!productCode) {
      return sendBadRequest(res, 'Produto inválido ou não encontrado.');
    }

    const rows = await productsImagensApi.listByProductCode(productCode, { onlyActive });

    return sendSuccess(res, rows, null, 200, {
      total: rows.length,
      product_code: productCode,
      filters: { onlyActive }
    });
  } catch (error) {
    console.error('[productsImagensController.listProductsImagensByProduct] erro:', error);
    return res.status(500).json({
      ok: false,
      error: buildErrorMessage(error, 'Falha ao listar imagens do produto.')
    });
  }
}

/* =========================================================================
   GET /api/products-imagens/by-code/:productCode/primary
   GET /api/products-imagens/product/:productId/primary   (legado)
   Retorna imagem principal do produto
   ========================================================================= */

export async function getPrimaryImageByProduct(req, res) {
  try {
    const productCode = await resolveCodeFromParams(req);

    if (!productCode) {
      return sendBadRequest(res, 'Produto inválido ou não encontrado.');
    }

    const row = await productsImagensApi.getPrimaryImageByProductCode(productCode);

    if (!row) {
      return sendNotFound(res, 'Nenhuma imagem principal encontrada para este produto.');
    }

    return sendSuccess(res, row);
  } catch (error) {
    console.error('[productsImagensController.getPrimaryImageByProduct] erro:', error);
    return res.status(500).json({
      ok: false,
      error: buildErrorMessage(error, 'Falha ao buscar imagem principal.')
    });
  }
}

/* =========================================================================
   GET /api/products-imagens/:id
   Busca por ID
   ========================================================================= */

export async function getProductsImagemById(req, res) {
  try {
    const id = toInt(req.params.id);

    if (!id || id <= 0) {
      return sendBadRequest(res, 'ID da imagem inválido.');
    }

    const row = await productsImagensApi.getById(id);

    if (!row) {
      return sendNotFound(res, 'Imagem não encontrada.');
    }

    return sendSuccess(res, row);
  } catch (error) {
    console.error('[productsImagensController.getProductsImagemById] erro:', error);
    return res.status(500).json({
      ok: false,
      error: buildErrorMessage(error, 'Falha ao buscar imagem.')
    });
  }
}

/* =========================================================================
   POST /api/products-imagens
   Cria nova imagem (registro apenas; upload de arquivo fica em
   POST /api/products/:product_code/imagem)
   Body:
   {
     product_code | product_id,
     barcode_id,
     image_url,
     image_path,
     image_alt,
     is_primary,
     position,
     is_active
   }
   ========================================================================= */

export async function createProductsImagem(req, res) {
  try {
    const payload = {
      product_code: normalizeString(req.body.product_code),
      product_id: toInt(req.body.product_id),
      barcode_id: toInt(req.body.barcode_id),
      image_url: normalizeString(req.body.image_url),
      image_path: normalizeString(req.body.image_path),
      image_alt: normalizeString(req.body.image_alt),
      is_primary: toBool(req.body.is_primary, false),
      position: toInt(req.body.position),
      is_active: toBool(req.body.is_active, true)
    };

    if (!payload.product_code && !(payload.product_id > 0)) {
      return sendBadRequest(res, 'Informe product_code ou product_id.');
    }

    if (!payload.image_url) {
      return sendBadRequest(res, 'O campo image_url é obrigatório.');
    }

    const created = await productsImagensApi.addImage(payload);

    return sendSuccess(
      res,
      created,
      'Imagem criada com sucesso.',
      201
    );
  } catch (error) {
    console.error('[productsImagensController.createProductsImagem] erro:', error);

    if (isDuplicateConstraintError(error, UNIT_IMAGE_PATH_CONSTRAINT)) {
      return res.status(409).json({
        ok: false,
        error: 'Já existe uma imagem com este image_path para este produto/unidade.'
      });
    }

    if (error?.status === 400) {
      return sendBadRequest(res, error.message);
    }

    return res.status(500).json({
      ok: false,
      error: buildErrorMessage(error, 'Falha ao criar imagem.')
    });
  }
}

/* =========================================================================
   PATCH /api/products-imagens/:id
   Atualiza parcialmente (produto/unidade não são alterados)
   ========================================================================= */

export async function updateProductsImagem(req, res) {
  try {
    const id = toInt(req.params.id);

    if (!id || id <= 0) {
      return sendBadRequest(res, 'ID da imagem inválido.');
    }

    const fields = {};
    const has = (key) => Object.prototype.hasOwnProperty.call(req.body ?? {}, key);

    if (has('image_url')) {
      fields.image_url = normalizeString(req.body.image_url);
      if (!fields.image_url) {
        return sendBadRequest(res, 'O campo image_url não pode ficar vazio.');
      }
    }

    // barcode_id: vincula a imagem a uma unidade; null/'' = imagem geral.
    if (has('barcode_id')) {
      const raw = req.body.barcode_id;
      const isBlank = raw === null || String(raw).trim() === '';
      const barcodeId = isBlank ? null : toInt(raw);
      if (!isBlank && !(barcodeId > 0)) {
        return sendBadRequest(res, 'barcode_id inválido.');
      }
      fields.barcode_id = barcodeId;
    }

    if (has('image_path')) fields.image_path = normalizeString(req.body.image_path);
    if (has('image_alt')) fields.image_alt = normalizeString(req.body.image_alt);
    if (has('is_primary')) fields.is_primary = toBool(req.body.is_primary, false);
    if (has('is_active')) fields.is_active = toBool(req.body.is_active, true);

    if (has('position')) {
      const position = toInt(req.body.position);
      if (!position || position <= 0) {
        return sendBadRequest(res, 'position inválido.');
      }
      fields.position = position;
    }

    const updated = await productsImagensApi.updateImage(id, fields);

    if (!updated) {
      return sendNotFound(res, 'Imagem não encontrada.');
    }

    return sendSuccess(
      res,
      updated,
      'Imagem atualizada com sucesso.'
    );
  } catch (error) {
    console.error('[productsImagensController.updateProductsImagem] erro:', error);

    if (isDuplicateConstraintError(error, UNIT_IMAGE_PATH_CONSTRAINT)) {
      return res.status(409).json({
        ok: false,
        error: 'Já existe uma imagem com este image_path para este produto/unidade.'
      });
    }

    if (error?.status === 400) {
      return sendBadRequest(res, error.message);
    }

    return res.status(500).json({
      ok: false,
      error: buildErrorMessage(error, 'Falha ao atualizar imagem.')
    });
  }
}

/* =========================================================================
   PATCH /api/products-imagens/:id/primary
   Define imagem principal (dentro da mesma unidade)
   Body opcional (validação de pertencimento):
   { product_code } ou { product_id }
   ========================================================================= */

export async function setProductsImagemPrimary(req, res) {
  try {
    const id = toInt(req.params.id);

    if (!id || id <= 0) {
      return sendBadRequest(res, 'ID da imagem inválido.');
    }

    const current = await productsImagensApi.getById(id);
    if (!current) {
      return sendNotFound(res, 'Imagem não encontrada.');
    }

    const bodyCode = normalizeString(req.body?.product_code);
    const bodyId = toInt(req.body?.product_id);

    if (bodyCode && bodyCode !== current.product_code) {
      return sendBadRequest(res, 'Esta imagem não pertence ao product_code informado.');
    }
    if (!bodyCode && bodyId && Number(current.product_id) !== bodyId) {
      return sendBadRequest(res, 'Esta imagem não pertence ao product_id informado.');
    }

    const updated = await productsImagensApi.setPrimaryImage(id);

    if (!updated) {
      return sendNotFound(res, 'Não foi possível definir a imagem principal.');
    }

    return sendSuccess(
      res,
      updated,
      'Imagem principal definida com sucesso.'
    );
  } catch (error) {
    console.error('[productsImagensController.setProductsImagemPrimary] erro:', error);
    return res.status(500).json({
      ok: false,
      error: buildErrorMessage(error, 'Falha ao definir imagem principal.')
    });
  }
}

/* =========================================================================
   PATCH /api/products-imagens/by-code/:productCode/reorder
   PATCH /api/products-imagens/product/:productId/reorder   (legado)
   Body:
   {
     orderedIds: [10, 5, 7]
   }
   ========================================================================= */

export async function reorderProductsImagens(req, res) {
  try {
    const productCode = await resolveCodeFromParams(req);
    const orderedIdsRaw = req.body?.orderedIds;

    if (!productCode) {
      return sendBadRequest(res, 'Produto inválido ou não encontrado.');
    }

    if (!Array.isArray(orderedIdsRaw) || orderedIdsRaw.length === 0) {
      return sendBadRequest(res, 'orderedIds deve ser um array não vazio.');
    }

    const orderedIds = orderedIdsRaw
      .map((id) => toInt(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!orderedIds.length) {
      return sendBadRequest(res, 'orderedIds inválido.');
    }

    const updatedRows = await productsImagensApi.reorderImages(productCode, orderedIds);

    return sendSuccess(
      res,
      updatedRows,
      'Ordem das imagens atualizada com sucesso.',
      200,
      {
        total: updatedRows.length,
        product_code: productCode
      }
    );
  } catch (error) {
    console.error('[productsImagensController.reorderProductsImagens] erro:', error);
    return res.status(500).json({
      ok: false,
      error: buildErrorMessage(error, 'Falha ao reordenar imagens.')
    });
  }
}

/* =========================================================================
   DELETE /api/products-imagens/:id
   Soft delete por padrão
   Query:
   - hard=true => hard delete
   ========================================================================= */

export async function deleteProductsImagem(req, res) {
  try {
    const id = toInt(req.params.id);
    const hard = toBool(req.query.hard, false);

    if (!id || id <= 0) {
      return sendBadRequest(res, 'ID da imagem inválido.');
    }

    if (hard) {
      const deleted = await productsImagensApi.hardDeleteImage(id);

      if (!deleted) {
        return sendNotFound(res, 'Imagem não encontrada.');
      }

      return sendSuccess(
        res,
        { deleted: true, hard: true, product_image_id: id },
        'Imagem removida definitivamente.'
      );
    }

    const deleted = await productsImagensApi.softDeleteImage(id);

    if (!deleted) {
      return sendNotFound(res, 'Imagem não encontrada.');
    }

    return sendSuccess(
      res,
      deleted,
      'Imagem desativada com sucesso.'
    );
  } catch (error) {
    console.error('[productsImagensController.deleteProductsImagem] erro:', error);
    return res.status(500).json({
      ok: false,
      error: buildErrorMessage(error, 'Falha ao excluir imagem.')
    });
  }
}

/* =========================================================================
   Alias default
   ========================================================================= */

const productsImagensController = {
  listAllProductsImagens,
  listProductsImagensByProduct,
  getPrimaryImageByProduct,
  getProductsImagemById,
  createProductsImagem,
  updateProductsImagem,
  setProductsImagemPrimary,
  reorderProductsImagens,
  deleteProductsImagem
};

export default productsImagensController;

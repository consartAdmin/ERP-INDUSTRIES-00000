// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/controllers/promoImagesController.js                  ║
// ║ MODULE: Promo Images Controller                                     ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import promoImagesApi from '../repositories/promoImages/promoImages.index.js';

function sendError(res, error, fallback = 'Erro interno no módulo de promoções.') {
  console.error('[promoImagesController][ERROR]', {
    message: error?.message,
    stack: error?.stack,
  });

  return res.status(error?.status || 500).json({
    ok: false,
    message: error?.message || fallback,
  });
}

export async function listPriceTables(req, res) {
  try {
    const rows = await promoImagesApi.listPriceTables();

    return res.json({
      ok: true,
      rows,
      count: rows.length,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function searchProducts(req, res) {
  try {
    const { price_id, q, limit } = req.query;

    const rows = await promoImagesApi.searchProducts({
      price_id,
      q,
      limit,
    });

    return res.json({
      ok: true,
      rows,
      count: rows.length,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function preview(req, res) {
  try {

    const result =
      await promoImagesApi.previewPromoImage(
        req.body || {}
      );

    return res.json({
      ok: true,
      preview: result.preview,
    });

  } catch (error) {
    return sendError(res, error);
  }
}

export async function generate(req, res) {
  try {
    const result = await promoImagesApi.generatePromoImage(req.body || {});

    return res.json({
      ok: true,
      message: 'Imagem promocional gerada com sucesso.',
      data: result,
      url: result.url,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export default {
  listPriceTables,
  searchProducts,
  preview,
  generate,
};
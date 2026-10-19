// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsMobileController.js                                   ║
// ║ MODULE: Products Mobile                                             ║
// ║ CONSART ERP | ESM                                                   ║
// ║ ✅ Controller para consulta mobile por código de barras / SKU        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import productsMobileApi from '../repositories/productsMobile/productsMobile.index.js';

function normalizeSearch(value) {
  return String(value || '').trim();
}

export async function getByBarcodeOrSku(req, res) {
  try {
    const search = normalizeSearch(
      req.params.search ||
      req.params.barcode ||
      req.query.search ||
      req.query.barcode ||
      req.query.sku
    );

    if (!search) {
      return res.status(400).json({
        success: false,
        message: 'Informe um código de barras ou SKU para consulta.',
        product: null,
      });
    }

    const result = await productsMobileApi.getByBarcodeOrSku(search);

    if (!result.found) {
      return res.status(404).json({
        success: false,
        found: false,
        message: 'Produto não encontrado para o código informado.',
        product: null,
      });
    }

    return res.json({
      success: true,
      found: true,
      message: 'Produto encontrado com sucesso.',
      product: result.product,
    });
  } catch (err) {
    console.error('[productsMobileController][getByBarcodeOrSku] ERROR:', {
      message: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      success: false,
      message: 'Erro interno ao consultar produto mobile.',
      error: err.message,
      product: null,
    });
  }
}

export async function listLocationOptions(req, res) {
  try {
    const rows = await productsMobileApi.listLocationOptions();

    return res.json({
      success: true,
      rows,
      count: rows.length,
    });
  } catch (err) {
    console.error('[productsMobileController][listLocationOptions] ERROR:', err);

    return res.status(500).json({
      success: false,
      message: 'Erro ao listar localizações.',
      error: err.message,
    });
  }
}

export async function updateProductLocation(req, res) {
  try {
    const productCode = normalizeSearch(req.params.product_code);
    const locationId = req.body.location_id || req.body.product_location_id;

    const row = await productsMobileApi.updateProductLocation(
      productCode,
      locationId
    );

    return res.json({
      success: true,
      message: 'Localização atualizada com sucesso.',
      row,
    });
  } catch (err) {
    console.error('[productsMobileController][updateProductLocation] ERROR:', err);

    return res.status(500).json({
      success: false,
      message: err.message || 'Erro ao atualizar localização.',
    });
  }
}

export async function getLocationByBarcode(req, res) {
  try {
    const barcode = normalizeSearch(req.params.barcode || req.query.barcode);

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: 'Informe o barcode da localização.',
        data: null,
      });
    }

    const data = await productsMobileApi.getLocationByBarcode(barcode);

    return res.json({
      success: true,
      found: true,
      data,
    });
  } catch (err) {
    console.error('[productsMobileController][getLocationByBarcode] ERROR:', err);

    return res.status(404).json({
      success: false,
      found: false,
      message: err.message || 'Localização não encontrada.',
      data: null,
    });
  }
}

export default {
  getByBarcodeOrSku,
  listLocationOptions,
  getLocationByBarcode,
  updateProductLocation,
};
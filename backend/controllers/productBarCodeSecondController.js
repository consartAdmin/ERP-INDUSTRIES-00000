// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productBarCodeSecondController.js — Controller (CONSART ERP | ESM)  ║
// ║ CRUD + busca por segundo código de barras                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import ProductBarCodeSecondAPI from '../repositories/productBarCodeSecond/productBarCodeSecond.index.js';

// Helper padrão para erros HTTP
function handleError(res, err) {
  console.error('[productBarCodeSecondController] error:', err);

  const status = err?.status || 500;
  const payload = {
    error: err?.message || 'Erro interno ao processar a requisição.',
  };

  if (err?.details) {
    payload.details = err.details;
  }

  res.status(status).json(payload);
}

/* ------------------------------------------------------------------------- */
/* Ensure table (opcional para startup)                                      */
/* ------------------------------------------------------------------------- */

export async function ensureTable(req, res) {
  try {
    const result = await ProductBarCodeSecondAPI.ensureTable();
    res.json({ ok: true, result });
  } catch (err) {
    handleError(res, err);
  }
}

/* ------------------------------------------------------------------------- */
/* List / Get                                                                */
/* ------------------------------------------------------------------------- */

// GET /api/product-barcode-second
export async function listSecondBarCodes(req, res) {
  try {
    const {
      q,
      product_code,
      product_unit_id,
      limit,
      offset,
      orderBy,
      dir,
    } = req.query;

    const result = await ProductBarCodeSecondAPI.list({
      q,
      product_code,
      product_unit_id,
      limit,
      offset,
      orderBy,
      dir,
    });

    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
}

// GET /api/product-barcode-second/:id
export async function getSecondBarCodeById(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Parâmetro "id" inválido.' });
    }

    const row = await ProductBarCodeSecondAPI.getById(id);
    if (!row) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }

    res.json(row);
  } catch (err) {
    handleError(res, err);
  }
}

// GET /api/product-barcode-second/by-code/:secondBarCode
export async function getBySecondBarCode(req, res) {
  try {
    const { secondBarCode } = req.params;
    if (!secondBarCode || !secondBarCode.trim()) {
      return res
        .status(400)
        .json({ error: 'Parâmetro "secondBarCode" é obrigatório.' });
    }

    const rows = await ProductBarCodeSecondAPI.findBySecondBarCode(
      secondBarCode.trim()
    );
    res.json({ rows });
  } catch (err) {
    handleError(res, err);
  }
}

/* ------------------------------------------------------------------------- */
/* Create / Upsert                                                           */
/* ------------------------------------------------------------------------- */

// POST /api/product-barcode-second
export async function createSecondBarCode(req, res) {
  try {
    const payload = req.body || {};
    const created = await ProductBarCodeSecondAPI.create(payload);
    res.status(201).json(created);
  } catch (err) {
    handleError(res, err);
  }
}

// PUT /api/product-barcode-second/upsert
export async function upsertSecondBarCode(req, res) {
  try {
    const payload = req.body || {};
    const saved = await ProductBarCodeSecondAPI.upsert(payload);
    res.json(saved);
  } catch (err) {
    handleError(res, err);
  }
}

/* ------------------------------------------------------------------------- */
/* Update / Delete                                                           */
/* ------------------------------------------------------------------------- */

// PATCH /api/product-barcode-second/:id
export async function updateSecondBarCode(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Parâmetro "id" inválido.' });
    }

    const patch = req.body || {};
    const updated = await ProductBarCodeSecondAPI.update(id, patch);
    if (!updated) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }

    res.json(updated);
  } catch (err) {
    handleError(res, err);
  }
}

// DELETE /api/product-barcode-second/:id
export async function deleteSecondBarCode(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Parâmetro "id" inválido.' });
    }

    const ok = await ProductBarCodeSecondAPI.remove(id);
    if (!ok) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }

    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
}

// Export default agrupado (se quiser importar como módulo único)
const ProductBarCodeSecondController = Object.freeze({
  ensureTable,
  listSecondBarCodes,
  getSecondBarCodeById,
  getBySecondBarCode,
  createSecondBarCode,
  upsertSecondBarCode,
  updateSecondBarCode,
  deleteSecondBarCode,
});

export default ProductBarCodeSecondController;

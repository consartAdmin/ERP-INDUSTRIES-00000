// ╔══════════════════════════════════════════════════════════════╗
// ║ FILE: backend/controllers/productsNotesController.js         ║
// ║ MODULE: Products Notes Controller                           ║
// ║ CONSART ERP | ESM                                           ║
// ╚══════════════════════════════════════════════════════════════╝

import productsNotesApi from '../repositories/productsNotes/productsNotes.index.js';

function sendError(res, error, fallback = 'Erro interno no módulo de anotações do produto.') {
  console.error('[productsNotesController][ERROR]', {
    message: error?.message,
    stack: error?.stack,
  });

  return res.status(error?.status || 500).json({
    ok: false,
    message: error?.message || fallback,
  });
}

export async function listProductNotes(req, res) {
  try {
    const productCode = String(req.params.productCode || req.query.product_code || '').trim();

    if (!productCode) {
      return res.status(400).json({
        ok: false,
        message: 'Código do produto não informado.',
      });
    }

    const rows = await productsNotesApi.listByProduct(productCode, {
      limit: req.query.limit,
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

export async function getProductNoteById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'ID inválido.',
      });
    }

    const row = await productsNotesApi.getById(id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        message: 'Anotação não encontrada.',
      });
    }

    return res.json({
      ok: true,
      row,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function createProductNote(req, res) {
  try {
    const body = req.body || {};

    const product_code = String(body.product_code || '').trim();
    const note = String(body.note || '').trim();

    if (!product_code) {
      return res.status(400).json({
        ok: false,
        message: 'Código do produto é obrigatório.',
      });
    }

    if (!note) {
      return res.status(400).json({
        ok: false,
        message: 'Anotação é obrigatória.',
      });
    }

    const row = await productsNotesApi.create({
      product_code,
      note_type: String(body.note_type || 'GENERAL').trim(),
      title: String(body.title || '').trim(),
      note,
      created_by: String(body.created_by || '').trim(),
    });

    return res.status(201).json({
      ok: true,
      message: 'Anotação criada com sucesso.',
      row,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateProductNote(req, res) {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'ID inválido.',
      });
    }

    const row = await productsNotesApi.update(id, {
      note_type: body.note_type ? String(body.note_type).trim() : null,
      title: body.title ? String(body.title).trim() : null,
      note: body.note ? String(body.note).trim() : null,
    });

    if (!row) {
      return res.status(404).json({
        ok: false,
        message: 'Anotação não encontrada.',
      });
    }

    return res.json({
      ok: true,
      message: 'Anotação atualizada com sucesso.',
      row,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function deleteProductNote(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'ID inválido.',
      });
    }

    const row = await productsNotesApi.softDelete(id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        message: 'Anotação não encontrada.',
      });
    }

    return res.json({
      ok: true,
      message: 'Anotação removida com sucesso.',
      row,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
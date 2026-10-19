// ╔══════════════════════════════════════════════════════════════╗
// ║ productsGradesController.js — Controller                    ║
// ║ CONSART ERP                                                 ║
// ╚══════════════════════════════════════════════════════════════╝

import * as api from '../repositories/productsGrades/productsGrades.index.js';

export async function list(req, res) {
  try {
    const product_id =
      (
        req.query.product_id ||
        req.query.productId ||
        ''
      ).toString();

    if (!product_id) {
      return res.status(400).json({
        ok: false,
        error: 'product_id é obrigatório',
      });
    }

    const limit = Number(req.query.limit || 500);
    const offset = Number(req.query.offset || 0);

    const data = await api.listByProduct(
      product_id,
      { limit, offset }
    );

    return res.json({
      ok: true,
      ...data,
    });

  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
}

export async function listByProductParam(req, res) {
  try {
    const product_id = req.params.id?.toString();

    const data = await api.listByProduct(
      product_id,
      {
        limit: Number(req.query.limit || 500),
        offset: Number(req.query.offset || 0),
      }
    );

    return res.json({
      ok: true,
      ...data,
    });

  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
}

/* ──────────────────────────────────────────────────────────────
   GET BY SKU
────────────────────────────────────────────────────────────── */
export async function getBySku(req, res) {
  try {
    const product_code =
      String(req.params.product_code || '').trim();

    if (!product_code) {
      return res.status(400).json({
        ok: false,
        error: 'product_code is required',
      });
    }

    const rows = await api.getBySku(product_code);

    return res.json({
      ok: true,
      rows,
    });

  } catch (err) {
    console.error(
      '[productsGradesController][getBySku]',
      err
    );

    return res.status(500).json({
      ok: false,
      error: err.message || 'Erro ao buscar grades',
    });
  }
}

export async function create(req, res) {
  try {
    const row = await api.createUpsert(req.body || {});

    return res.status(201).json({
      ok: true,
      data: row,
    });

  } catch (e) {
    return res.status(400).json({
      ok: false,
      error: e.message,
    });
  }
}

export async function update(req, res) {
  try {
    const row = await api.update(
      req.params.id,
      req.body || {}
    );

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'Not Found',
      });
    }

    return res.json({
      ok: true,
      data: row,
    });

  } catch (e) {
    return res.status(400).json({
      ok: false,
      error: e.message,
    });
  }
}

export async function remove(req, res) {
  try {
    const out = await api.remove(req.params.id);

    return res.json({
      ok: true,
      ...out,
    });

  } catch (e) {
    return res.status(400).json({
      ok: false,
      error: e.message,
    });
  }
}
// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBoxesController.js — Controller (ESM)                         ║
// ║ Path: backend/controllers/productsBoxesController.js                  ║
// ║ - CRUD Boxes                                                         ║
// ║ - Itens por Box (com product_description via JOIN no API layer)       ║
// ║ - By-product (1 box principal ou lista de boxes)                      ║
// ║ - PDFs                                                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  listBoxes,
  getBoxById,
  createBox,
  updateBox,
  deleteBox,
  listBoxItems,
  upsertBoxItem,
  deleteBoxItem,
  listBoxesByProductCode,
  getBoxByProductCode,
} from '../repositories/productsBoxes/productsBoxes.index.js';

import { generateProductsBoxesPdf } from '../generationPdf/generationProductsBoxesPdf.js';

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
function ok(res, data, extra = {}) {
  return res.json({ ok: true, ...extra, data });
}

function fail(res, err) {
  const status = Number(err?.status) || 500;
  const message = err?.message || 'Internal error';
  return res.status(status).json({ ok: false, message });
}

function asInt(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function pickSkuParam(req) {
  // Aceita qualquer um: :product_code OU :sku
  const raw = req.params?.product_code ?? req.params?.sku ?? req.query?.sku ?? req.query?.product_code ?? '';
  return String(raw || '').trim();
}

/* ──────────────────────────────────────────────────────────────
   Boxes
────────────────────────────────────────────────────────────── */
export async function listBoxesHandler(req, res) {
  try {
    const result = await listBoxes({
      q: req.query.q,
      active: req.query.active,
      page: asInt(req.query.page, 1),
      pageSize: asInt(req.query.pageSize, 20),
      orderBy: req.query.orderBy || 'created_at DESC',
    });
    return ok(res, result);
  } catch (err) {
    return fail(res, err);
  }
}

// ✅ útil pro SELECT do editProducts: retorna lista leve (id + name)
export async function listBoxesOptionsHandler(req, res) {
  try {
    const result = await listBoxes({
      q: req.query.q,
      active: req.query.active ?? 'true',
      page: 1,
      pageSize: asInt(req.query.pageSize, 5000),
      orderBy: req.query.orderBy || 'name ASC',
    });

    // tenta normalizar: se o serviço retornar { rows } ou { data:{rows} } etc.
    const rows =
      Array.isArray(result?.rows) ? result.rows :
      Array.isArray(result?.data?.rows) ? result.data.rows :
      Array.isArray(result?.data) ? result.data :
      Array.isArray(result) ? result :
      [];

    const options = rows.map(r => ({
      box_id: r.box_id,
      name: r.name,
    }));

    return ok(res, options);
  } catch (err) {
    return fail(res, err);
  }
}

export async function getBoxHandler(req, res) {
  try {
    const box = await getBoxById(req.params.box_id);
    if (!box) return res.status(404).json({ ok: false, message: 'Box not found' });
    return ok(res, box);
  } catch (err) {
    return fail(res, err);
  }
}

export async function createBoxHandler(req, res) {
  try {
    const created = await createBox(req.body || {});
    return res.status(201).json({ ok: true, data: created });
  } catch (err) {
    return fail(res, err);
  }
}

export async function updateBoxHandler(req, res) {
  try {
    const updated = await updateBox(req.params.box_id, req.body || {});
    if (!updated) return res.status(404).json({ ok: false, message: 'Box not found' });
    return ok(res, updated);
  } catch (err) {
    return fail(res, err);
  }
}

export async function deleteBoxHandler(req, res) {
  try {
    const deleted = await deleteBox(req.params.box_id);
    if (!deleted) return res.status(404).json({ ok: false, message: 'Box not found' });
    return ok(res, deleted);
  } catch (err) {
    return fail(res, err);
  }
}

/* ──────────────────────────────────────────────────────────────
   Itens (SKUs) dentro do Box
────────────────────────────────────────────────────────────── */
export async function listBoxItemsHandler(req, res) {
  try {
    const box = await getBoxById(req.params.box_id);
    if (!box) return res.status(404).json({ ok: false, message: 'Box not found' });

    const items = await listBoxItems(req.params.box_id);
    return ok(res, items, { box });
  } catch (err) {
    return fail(res, err);
  }
}

export async function upsertBoxItemHandler(req, res) {
  try {
    const box = await getBoxById(req.params.box_id);
    if (!box) return res.status(404).json({ ok: false, message: 'Box not found' });

    const saved = await upsertBoxItem(req.params.box_id, req.body || {});
    return ok(res, saved);
  } catch (err) {
    return fail(res, err);
  }
}

export async function deleteBoxItemHandler(req, res) {
  try {
    const box = await getBoxById(req.params.box_id);
    if (!box) return res.status(404).json({ ok: false, message: 'Box not found' });

    const sku = req.params.sku;
    const deleted = await deleteBoxItem(req.params.box_id, sku);
    if (!deleted) return res.status(404).json({ ok: false, message: 'Item not found' });

    return ok(res, deleted);
  } catch (err) {
    return fail(res, err);
  }
}

/* ──────────────────────────────────────────────────────────────
   PDF — Download (BOX ÚNICO)
────────────────────────────────────────────────────────────── */
export async function downloadBoxPdfHandler(req, res) {
  try {
    const boxId = req.params.box_id;
    const includeItems = String(req.query.includeItems ?? 'true').toLowerCase() === 'true';

    const box = await getBoxById(boxId);
    if (!box) return res.status(404).json({ ok: false, message: 'Box not found' });

    const { filename, filepath } = await generateProductsBoxesPdf({
      box_id: boxId,
      includeItems,
    });

    return res.download(filepath, filename);
  } catch (err) {
    return fail(res, err);
  }
}

/* ──────────────────────────────────────────────────────────────
   PDF — Download (LISTAGEM)
────────────────────────────────────────────────────────────── */
export async function downloadBoxesListPdfHandler(req, res) {
  try {
    const includeItems = String(req.query.includeItems ?? 'true').toLowerCase() === 'true';

    const { filename, filepath } = await generateProductsBoxesPdf({
      box_id: null,
      q: req.query.q || null,
      active: req.query.active ?? 'true',
      orderBy: req.query.orderBy || 'created_at DESC',
      page: Number(req.query.page || 1),
      pageSize: Number(req.query.pageSize || 200),
      includeItems,
    });

    return res.download(filepath, filename);
  } catch (err) {
    return fail(res, err);
  }
}

/* ──────────────────────────────────────────────────────────────
   BY PRODUCT (SKU)
────────────────────────────────────────────────────────────── */

// ✅ lista TODAS as caixas que possuem o SKU (se você quiser usar)
export async function listBoxesByProductCodeHandler(req, res) {
  try {
    const sku = pickSkuParam(req);
    if (!sku) return res.status(400).json({ ok: false, message: 'product_code obrigatório' });

    const rows = await listBoxesByProductCode(sku);
    return ok(res, rows);
  } catch (err) {
    return fail(res, err);
  }
}

// ✅ retorna 1 caixa "principal" do SKU (ideal pra preencher o select)
export async function getBoxByProductCodeHandler(req, res) {
  try {
    const sku = pickSkuParam(req);
    if (!sku) return res.status(400).json({ ok: false, message: 'product_code obrigatório' });

    const box = await getBoxByProductCode(sku);
    return res.json({ ok: true, data: box || null });
  } catch (err) {
    return fail(res, err);
  }
}

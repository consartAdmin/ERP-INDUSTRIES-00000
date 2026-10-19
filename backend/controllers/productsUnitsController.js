// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsUnitsController.js — HTTP Controller (CONSART ERP | ESM)     ║
// ║ - CRUD productsUnits                                                 ║
// ║ - factorsBySkus (modal rentabilidade)                                ║
// ║ - ✅ Barcode lookup                                                  ║
// ║ - ✅ FIX: canonical = product_code (SKU)                              ║
// ║ - ✅ Compat: aceita product_id como alias legado                      ║
// ║ - ✅ FIX: whitelist orderBy/dir                                      ║
// ║ - ✅ FIX: parse seguro de limit/offset/unit_id                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import ProductsUnitsAPI from '../repositories/productsUnits/productsUnits.index.js';

// ✅ NOVO: sync barcode -> productsBarCode
import pool from '../config/db.js';
import { productsBarCodeApi } from '../repositories/productsBarCode/productsBarCode.index.js';

/* ────────────────────────────────────────────────────────────────────────────
   Helpers: parse/normalize
──────────────────────────────────────────────────────────────────────────── */
function toInt(v, def = null) {
  const n = Number(v);
  return Number.isInteger(n) ? n : def;
}
function toPosInt(v, def = null) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : def;
}
function toBoolOrNull(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'sim'].includes(s)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'nao', 'não'].includes(s)) return false;
  return null;
}
function toStr(v) {
  const s = String(v ?? '').trim();
  return s ? s : null;
}

/* ────────────────────────────────────────────────────────────────────────────
   Helpers: barcode sync
──────────────────────────────────────────────────────────────────────────── */
function pickBarcodeFromBody(body = {}) {
  const v =
    body.barcode ??
    body.unit_barcode ??
    body.product_barcode ??
    body.codigo_barras ??
    body.ean ??
    body.gtin ??
    body.gtin13 ??
    body.gtin14 ??
    null;

  const s = String(v ?? '').trim();
  return s ? s : null;
}

function pickProductCodeFromBodyOrRow(body = {}, row = {}) {
  // ✅ canonical: product_code
  const v =
    body.product_code ??
    body.sku ??
    body.product_id ?? // alias legado (productsUnits.product_id = SKU/texto)
    row.product_code ??
    row.sku ??
    row.product_id ??
    null;

  const s = String(v ?? '').trim();
  return s ? s : null;
}

function pickProductUnitIdFromRow(row = {}) {
  const v = row.product_unit_id ?? row.id ?? row.productUnitId ?? null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function syncBarcodeToProductsBarCode({ body, row }) {
  try {
    const barcode = pickBarcodeFromBody(body);
    if (!barcode) return { ok: true, skipped: true, reason: 'no_barcode' };

    const product_code = pickProductCodeFromBodyOrRow(body, row);
    const product_unit_id = pickProductUnitIdFromRow(row);

    if (!product_code) return { ok: false, skipped: false, reason: 'missing_product_code' };
    if (!product_unit_id) return { ok: false, skipped: false, reason: 'missing_product_unit_id' };

    const result = await productsBarCodeApi.upsertForUnit(pool, {
      product_code,
      product_unit_id,
      barcode,
      is_active: true,
    });

    return { ok: true, skipped: false, product_code, product_unit_id, barcode, result };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      error: err?.message || 'barcode_sync_error',
      code: err?.code || null,
      detail: err?.detail || null,
    };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Helpers: query normalize (canonical = product_code)
──────────────────────────────────────────────────────────────────────────── */
function pickProductCodeFromQuery(q = {}) {
  // ✅ canonical = product_code
  const code =
    q.product_code ??
    q.sku ??
    q.productId ??
    null;

  const legacy = q.product_id ?? null; // alias legado (ainda aceito)

  const sku = toStr(code) || toStr(legacy);
  return sku;
}

// whitelist segura p/ orderBy (evita 500 e injection)
const ORDER_BY_ALLOW = new Set([
  'product_unit_id',
  'product_id',
  'product_code',
  'unit_id',
  'unit',
  'description',
  'fator',
  'standard',
  'created_at',
  'updated_at',
]);

function normalizeOrderBy(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  // aceita "product_code" mas mantém compat com campo "product_id"
  if (s === 'sku') return 'product_code';
  if (ORDER_BY_ALLOW.has(s)) return s;
  return null;
}

function normalizeDir(v) {
  const s = String(v ?? '').trim().toUpperCase();
  return s === 'DESC' ? 'DESC' : 'ASC';
}

/* ────────────────────────────────────────────────────────────────────────────
   Ensure
──────────────────────────────────────────────────────────────────────────── */
export async function ensure(_req, res, next) {
  try {
    const ok = await ProductsUnitsAPI.ensureProductsUnitsTable();
    res.json(ok);
  } catch (err) {
    next(err);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   List
   ✅ Agora aceita ?product_code=SKU (canonical)
   ♻️ Compat: ?product_id=SKU (legado)
──────────────────────────────────────────────────────────────────────────── */
export async function list(req, res, next) {
  try {
    const sku = pickProductCodeFromQuery(req.query);

    // ✅ repassa product_code CANONICAL para o ProductsUnitsAPI
    const data = await ProductsUnitsAPI.list({
      q: toStr(req.query.q),

      // ✅ canonical (o ProductsUnitsAPI já aceita product_code)
      product_code: sku,

      // ♻️ compat: se alguém chamar com product_id no query, pickProductCodeFromQuery já captura.
      // Não precisa mandar product_id aqui.

      unit_id: toPosInt(req.query.unit_id, null),
      standard: toBoolOrNull(req.query.standard),

      include_inactive: toBoolOrNull(req.query.include_inactive) ?? false,

      limit: toPosInt(req.query.limit, 50) ?? 50,
      offset: toInt(req.query.offset, 0) ?? 0,

      orderBy: normalizeOrderBy(req.query.orderBy),
      dir: normalizeDir(req.query.dir),
    });

    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Get By Id
──────────────────────────────────────────────────────────────────────────── */
export async function getById(req, res, next) {
  try {
    const row = await ProductsUnitsAPI.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not Found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Create
──────────────────────────────────────────────────────────────────────────── */
export async function create(req, res, next) {
  try {
    const row = await ProductsUnitsAPI.create(req.body);

    // ✅ SYNC barcode -> productsBarCode
    const barcode_sync = await syncBarcodeToProductsBarCode({ body: req.body, row });

    res.status(201).json({ ...row, barcode_sync });
  } catch (err) {
    next(err);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Upsert
──────────────────────────────────────────────────────────────────────────── */
export async function upsert(req, res) {
  try {
    console.log('[products-units/upsert] body =>', req.body);

    const row = await ProductsUnitsAPI.upsert(req.body);

    // ✅ SYNC barcode -> productsBarCode
    const barcode_sync = await syncBarcodeToProductsBarCode({ body: req.body, row });

    return res.json({ ...row, barcode_sync });
  } catch (err) {
    console.error('[products-units/upsert] ERROR =>', {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
      table: err?.table,
      column: err?.column,
      where: err?.where,
      status: err?.status,
      stack: err?.stack,
    });

    return res.status(err?.status || 500).json({
      ok: false,
      error: err?.message || 'Internal Error',
      code: err?.code || null,
      detail: err?.detail || null,
      constraint: err?.constraint || null,
    });
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Update
──────────────────────────────────────────────────────────────────────────── */
export async function update(req, res, next) {
  try {
    const row = await ProductsUnitsAPI.update(req.params.id, req.body);

    // ✅ SYNC barcode -> productsBarCode
    const barcode_sync = await syncBarcodeToProductsBarCode({ body: req.body, row });

    res.json({ ...row, barcode_sync });
  } catch (err) {
    next(err);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Deactivate
──────────────────────────────────────────────────────────────────────────── */
export async function deactivate(req, res, next) {
  try {
    const row = await ProductsUnitsAPI.deactivate(req.params.id);
    res.json(row);
  } catch (err) {
    next(err);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Remove
──────────────────────────────────────────────────────────────────────────── */
export async function remove(req, res, next) {
  try {
    const ok = await ProductsUnitsAPI.remove(req.params.id);
    res.json({ ok });
  } catch (err) {
    next(err);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   ✅ Barcode lookup
   GET /api/product-units/by-barcode?barcode=789...
   ✅ aceita também &product_code=SKU (canonical) ou &product_id=SKU (legado)
──────────────────────────────────────────────────────────────────────────── */
export async function getByBarcode(req, res, next) {
  try {
    const barcode = String(req.query?.barcode || '').trim();
    const sku = pickProductCodeFromQuery(req.query);

    if (!barcode) {
      return res.status(400).json({ error: 'Param "barcode" é obrigatório.' });
    }

    if (typeof ProductsUnitsAPI.getByBarcode !== 'function') {
      return res.status(500).json({ error: 'ProductsUnitsAPI.getByBarcode() não está implementado.' });
    }

    // ✅ usa canonical
    const row = await ProductsUnitsAPI.getByBarcode(barcode, { product_code: sku });

    if (!row) {
      return res.status(404).json({ error: 'Barcode não encontrado.' });
    }

    // ✅ retorna a unidade direto (front antigo e novo entendem)
    return res.json(row);
  } catch (err) {
    return next(err);
  }
}


/* ────────────────────────────────────────────────────────────────────────────
   Factors by SKUs (para modal rentabilidade)
──────────────────────────────────────────────────────────────────────────── */
export async function getFactorsBySkus(req, res, next) {
  try {
    const raw = String(req.query?.skus || '').trim();

    const skus = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 500);

    if (!skus.length) {
      return res.status(400).json({ ok: false, error: 'Param "skus" é obrigatório.' });
    }

    const rawRows = await ProductsUnitsAPI.factorsBySkus(skus);

    const rows = [];
    const pushRow = (obj) => {
      const sku = String(
        obj?.sku ??
          obj?.product_code ??
          obj?.code ??
          obj?.product ??
          obj?.productCode ??
          ''
      ).trim();

      const unit = String(
        obj?.unit ??
          obj?.unit_code ??
          obj?.unitCode ??
          obj?.um ??
          obj?.u_m ??
          obj?.unidade ??
          obj?.unidade_venda ??
          obj?.unidadeVenda ??
          obj?.sale_unit ??
          obj?.sales_unit ??
          obj?.unit_name ??
          obj?.abbrev ??
          ''
      )
        .trim()
        .toUpperCase();

      const factorNum = Number(
        obj?.factor ??
          obj?.multiplier ??
          obj?.fator ??
          obj?.conversion_factor ??
          obj?.conversionFactor ??
          obj?.qty_factor ??
          obj?.qtyFactor ??
          1
      );

      const factor = Number.isFinite(factorNum) && factorNum > 0 ? factorNum : 1;

      if (!sku || !unit) return;

      rows.push({ sku, unit, factor });
    };

    if (Array.isArray(rawRows)) {
      for (const r of rawRows) {
        if (r && Array.isArray(r.units)) {
          const sku = String(r.sku ?? r.product_code ?? '').trim();
          for (const u of r.units) pushRow({ ...u, sku });
          continue;
        }
        pushRow(r);
      }
    }

    const dedup = new Map();
    for (const r of rows) dedup.set(`${r.sku}||${r.unit}`, r);
    const finalRows = Array.from(dedup.values());

    return res.json({
      ok: true,
      rows: finalRows,
      meta: {
        skus_requested: skus.length,
        rows: finalRows.length,
        sample: finalRows.slice(0, 10),
      },
    });
  } catch (err) {
    console.error('[product-units/factors] ERROR', {
      code: err?.code,
      message: err?.message,
    });
    next(err);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Default export
──────────────────────────────────────────────────────────────────────────── */
const ProductsUnitsController = {
  ensure,
  list,
  getById,
  create,
  upsert,
  update,
  deactivate,
  remove,

  getFactorsBySkus,
  getByBarcode,
};

export default ProductsUnitsController;

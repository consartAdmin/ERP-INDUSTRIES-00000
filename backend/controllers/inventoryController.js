// ╔══════════════════════════════════════════════════════════════════╗
// ║ inventoryController.js — Controller REST de Inventories         ║
// ║ Rotas em: /api/inventories                                      ║
// ║ ✅ Finalize com senha (env INVENTORY_FINALIZE_PASSWORD)          ║
// ║ ✅ Itens: força uso de product_code (SKU)                        ║
// ║ ✅ FIX: mapeia erros PG (23505/23503)                            ║
// ║ ✅ FIX: loga erro raiz (code/detail/constraint)                  ║
// ║ ✅ NOVO: importação XLS/XLSX via multer + xlsx                   ║
// ╚══════════════════════════════════════════════════════════════════╝

'use strict';

import fs from 'node:fs/promises';
import path from 'node:path';
import XLSX from 'xlsx';

import * as svc from '../repositories/inventory/inventory.index.js';

import generateInventoryImportReportPdf from '../generationPdf/generationInventoryReportsPdf.js';

/* ========================================================================== */
/* Helpers                                                                    */
/* ========================================================================== */

function getUserCtx(req) {
  const u = req.user || {};
  return {
    id: u.id ?? u.user_id ?? null,
    name: u.name ?? u.user_name ?? u.username ?? null,
  };
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function toNullableInt(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (!/^-?\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function toNullableNumber(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const s = String(value).trim();
  if (!s) return null;

  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;

  const s = String(value).trim().toLowerCase();
  if (!s) return fallback;

  return ['1', 'true', 'sim', 'yes', 'y', 'on'].includes(s);
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function parseDateLoose(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const dt = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return dt.toISOString();
    }
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) {
    return iso.toISOString();
  }

  const br = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    const dt = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }

  return null;
}

function getCell(row, aliases = []) {
  if (!row || typeof row !== 'object') return null;

  const keys = Object.keys(row);
  if (!keys.length) return null;

  for (const alias of aliases) {
    if (alias in row) return row[alias];
  }

  const normalizedMap = new Map(
    keys.map((k) => [normalizeText(k), k])
  );

  for (const alias of aliases) {
    const hit = normalizedMap.get(normalizeText(alias));
    if (hit) return row[hit];
  }

  return null;
}

function normalizeItemPayload(body = {}) {
  const payload = { ...(body || {}) };

  const code =
    payload.product_code ??
    payload.productCode ??
    payload.sku ??
    payload.code ??
    null;

  payload.product_code = code != null ? String(code).trim() : '';

  const unitId =
    payload.product_unit_id ??
    payload.productUnitId ??
    payload.unit_id ??
    payload.unitId ??
    null;

  const locId =
    payload.product_location_id ??
    payload.productLocationId ??
    payload.location_id ??
    payload.locationId ??
    null;

  const lotId =
    payload.lot_id ??
    payload.lotId ??
    payload.lote_id ??
    payload.loteId ??
    null;

  payload.product_unit_id =
    unitId != null && String(unitId).trim() !== '' && /^\d+$/.test(String(unitId).trim())
      ? parseInt(String(unitId).trim(), 10)
      : null;

  payload.product_location_id =
    locId != null && String(locId).trim() !== '' && /^\d+$/.test(String(locId).trim())
      ? parseInt(String(locId).trim(), 10)
      : null;

  payload.lot_id =
    lotId != null && String(lotId).trim() !== '' && /^\d+$/.test(String(lotId).trim())
      ? parseInt(String(lotId).trim(), 10)
      : null;

  delete payload.productCode;
  delete payload.sku;
  delete payload.code;

  delete payload.productUnitId;
  delete payload.unit_id;
  delete payload.unitId;

  delete payload.productLocationId;
  delete payload.location_id;
  delete payload.locationId;

  delete payload.lotId;
  delete payload.lote_id;
  delete payload.loteId;

  return payload;
}

function handlePgError(err, res) {
  if (err?.code === '23505') {
    return res.status(409).json({
      ok: false,
      error: 'Item já existe para este inventário (mesmo produto/unidade/localização).',
      code: err.code,
      detail: err.detail,
    });
  }

  if (err?.code === '23503') {
    return res.status(400).json({
      ok: false,
      error: 'Referência inválida (produto/unidade/localização).',
      code: err.code,
      detail: err.detail,
    });
  }

  return null;
}

function logRootError(scope, err) {
  console.error(`[inventoryController] ${scope}:`, {
    message: err?.message,
    code: err?.code,
    detail: err?.detail,
    where: err?.where,
    schema: err?.schema,
    table: err?.table,
    column: err?.column,
    constraint: err?.constraint,
    routine: err?.routine,
    stack: err?.stack,
  });
}

function mapRowToInventoryItem(row = {}) {
  const barcodeRaw = getCell(row, [
    'barcode',
    'ean',
    'codigo_barras',
    'código_barras',
  ]);

  const productCodeRaw = getCell(row, [
    'product_code',
    'product code',
    'codigo',
    'código',
    'sku',
    'cod',
    'code',
  ]);

  const qtyCounted =
    toNullableNumber(
      getCell(row, [
        'counted_qty',
        'counted quantity',
        'quantity_counted',
        'qty_counted',
        'qtd_contada',
        'quantidade_contada',
        'qtd',
        'quantidade',
        'qty',
        'count',
      ])
    ) ?? 0;

  const productUnitId = toNullableInt(
    getCell(row, [
      'product_unit_id',
      'unit_id',
      'unidade_id',
      'id_unidade',
    ])
  );

  const productLocationId = toNullableInt(
    getCell(row, [
      'product_location_id',
      'location_id',
      'localizacao_id',
      'localização_id',
      'id_localizacao',
      'id_localização',
    ])
  );

  const lotId = toNullableInt(
    getCell(row, [
      'lot_id',
      'lote_id',
      'id_lote',
    ])
  );

  const notes = String(
    getCell(row, [
      'notes',
      'note',
      'observacao',
      'observação',
      'obs',
      'remarks',
    ]) ?? ''
  ).trim();

  return {
    barcode: String(barcodeRaw ?? '').trim(),
    product_code: String(productCodeRaw ?? '').trim(),
    counted_qty: qtyCounted,
    product_unit_id: productUnitId,
    product_location_id: productLocationId,
    lot_id: lotId,
    notes: notes || null,
  };
}

async function ensureInventoryForImport(req) {
  const inventoryId = toNullableInt(req.body?.inventory_id ?? req.body?.inventoryId);
  if (inventoryId) {
    const existing = await svc.getById(inventoryId);
    if (!existing) {
      const err = new Error('Inventory not found');
      err.httpStatus = 404;
      throw err;
    }
    return existing;
  }

  const userCtx = getUserCtx(req);
  const fileName = req.file?.originalname
    ? path.parse(req.file.originalname).name
    : `IMPORTACAO ${new Date().toISOString().slice(0, 10)}`;

  const referenceDate =
    parseDateLoose(req.body?.reference_date ?? req.body?.referenceDate) ||
    new Date().toISOString();

  const payload = {
    code: String(req.body?.code || req.body?.description || fileName || '').trim() || `IMPORTAÇÃO ${new Date().toLocaleDateString('pt-BR')}`,
    description: req.body?.description ? String(req.body.description).trim() : null,
    type: String(req.body?.type || 'GENERAL').trim().toUpperCase(),
    status: String(req.body?.status || 'OPEN').trim().toUpperCase(),
    reference_date: referenceDate,
    notes: req.body?.notes ? String(req.body.notes).trim() : `Importado de planilha: ${req.file?.originalname || 'arquivo'}`,
    created_by: userCtx.id ?? null,
  };

  return svc.create(payload);
}

function buildImportSummary({ inventory, created, skipped, errors, sourceRows }) {
  return {
    ok: errors.length === 0,
    inventory_id: inventory?.inventory_id ?? inventory?.id ?? null,
    inventory_code: inventory?.code ?? null,
    source_rows: sourceRows,
    imported_items: created.length,
    skipped_items: skipped.length,
    error_items: errors.length,
    created,
    skipped,
    errors,
  };
}

/* ========================================================================== */
/* CRUD                                                                       */
/* ========================================================================== */

export async function list(req, res, next) {
  try {
    const { search, status, limit, offset } = req.query;

    const data = await svc.list({
      search,
      status,
      limit: limit != null ? Number(limit) : undefined,
      offset: offset != null ? Number(offset) : undefined,
    });

    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid inventory id' });
    }

    const inv = await svc.getById(id);
    if (!inv) {
      return res.status(404).json({ ok: false, error: 'Inventory not found' });
    }

    return res.json(inv);
  } catch (err) {
    return next(err);
  }
}

export async function create(req, res, next) {
  try {
    const payload = req.body || {};
    const userCtx = getUserCtx(req);

    if (userCtx.id && !payload.created_by) {
      payload.created_by = userCtx.id;
    }

    const inv = await svc.create(payload);
    return res.status(201).json(inv);
  } catch (err) {
    return next(err);
  }
}

export async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid inventory id' });
    }

    const payload = req.body || {};
    const inv = await svc.update(id, payload);

    if (!inv) {
      return res.status(404).json({ ok: false, error: 'Inventory not found' });
    }

    return res.json(inv);
  } catch (err) {
    return next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid inventory id' });
    }

    const inv = await svc.remove(id);
    if (!inv) {
      return res.status(404).json({ ok: false, error: 'Inventory not found' });
    }

    return res.json(inv);
  } catch (err) {
    return next(err);
  }
}

/* ========================================================================== */
/* Items                                                                      */
/* ========================================================================== */

export async function listItems(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid inventory id' });
    }

    const rows = await svc.listItems(id);
    return res.json({ rows });
  } catch (err) {
    return next(err);
  }
}

export async function addItem(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid inventory id' });
    }

    const payload = normalizeItemPayload(req.body || {});
    const userCtx = getUserCtx(req);

    if (!payload.product_code) {
      return res.status(400).json({ ok: false, error: 'product_code is required' });
    }

    const item = await svc.addItem(id, payload, userCtx);
    return res.status(201).json(item);
  } catch (err) {
    logRootError('addItem error', err);

    const handled = handlePgError(err, res);
    if (handled) return handled;

    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Internal error',
        code: err?.code || null,
        detail: err?.detail || null,
      });
    }

    return next(err);
  }
}

export async function removeItem(req, res, next) {
  try {
    const inventoryId = Number(req.params.id);
    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid inventory id' });
    }

    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid item id' });
    }

    const item = await svc.removeItemFromInventory(inventoryId, itemId);
    if (!item) {
      return res.status(404).json({ ok: false, error: 'Item not found for this inventory' });
    }

    return res.json(item);
  } catch (err) {
    return next(err);
  }
}

/* ========================================================================== */
/* Import XLS/XLSX                                                            */
/* ========================================================================== */

export async function importInventoryXls(req, res, next) {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: 'Nenhum arquivo foi enviado.',
      });
    }

    filePath = req.file.path;

    const workbook = XLSX.readFile(filePath, {
      cellDates: true,
      raw: true,
      cellText: false,
      cellNF: false,
    });

    const firstSheetName = workbook.SheetNames?.[0];
    if (!firstSheetName) {
      return res.status(400).json({
        ok: false,
        error: 'A planilha não possui abas válidas.',
      });
    }

    const sheet = workbook.Sheets[firstSheetName];

    const aoa = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false,
    });

    if (!Array.isArray(aoa) || aoa.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'A planilha está vazia.',
      });
    }

    // remove linha sep=; se existir
    if (
      Array.isArray(aoa[0]) &&
      String(aoa[0][0] ?? '').trim().toLowerCase().startsWith('sep=')
    ) {
      aoa.shift();
    }

    if (aoa.length < 2) {
      return res.status(400).json({
        ok: false,
        error: 'A planilha não possui cabeçalho e linhas de dados suficientes.',
      });
    }

    const headers = aoa[0].map((h) => String(h ?? '').trim());
    const dataRows = aoa.slice(1);

    const rows = dataRows.map((line) => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = line[idx] ?? null;
      });
      return obj;
    });

    const inventory = await ensureInventoryForImport(req);
    const userCtx = getUserCtx(req);

    const created = [];
    const skipped = [];
    const errors = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const lineNumber = index + 2;
      const payload = mapRowToInventoryItem(row);

      let finalPayload = null;

      if (payload.barcode) {
        finalPayload = await svc.resolveInventoryPayloadFromBarcode(payload.barcode, payload);

        if (!finalPayload) {
          skipped.push({
            line: lineNumber,
            reason: `Linha ignorada: barcode não encontrado (${payload.barcode}).`,
            row,
          });
          continue;
        }
      } else if (payload.product_code) {
        finalPayload = normalizeItemPayload(payload);
      } else {
        skipped.push({
          line: lineNumber,
          reason: 'Linha ignorada: informe barcode ou product_code/SKU.',
          row,
        });
        continue;
      }

      try {
        const item = await svc.addItem(
          Number(inventory.inventory_id ?? inventory.id),
          finalPayload,
          userCtx
        );

        created.push({
          line: lineNumber,
          barcode: payload.barcode || null,
          product_code: finalPayload.product_code,
          product_name: item?.product_name || null,
          unit: item?.unit || finalPayload?.unit || null,
          counted_qty: finalPayload?.counted_qty ?? null,
          location_name: item?.location_name || null,
          lot_code: item?.lot_code || null,
          item_id: item?.inventory_item_id ?? item?.item_id ?? item?.id ?? null,
        });
      } catch (err) {
        errors.push({
          line: lineNumber,
          barcode: payload.barcode || null,
          product_code: finalPayload?.product_code || payload.product_code || null,
          error: err?.message || 'Erro ao importar item.',
          code: err?.code || null,
          detail: err?.detail || null,
        });
      }
    }

    const summary = buildImportSummary({
      inventory,
      created,
      skipped,
      errors,
      sourceRows: rows.length,
    });

    const wantsPdf =
      String(req.body?.generate_pdf || req.body?.generatePdf || req.query?.generate_pdf || '')
        .toLowerCase() === 'true';

    if (wantsPdf) {
      const doc = generateInventoryImportReportPdf({
        inventory_id: summary.inventory_id,
        inventory_code: summary.inventory_code,
        inventory_description: inventory?.description || inventory?.code || null,
        filename: req.file?.originalname || null,
        user_name: userCtx?.name || null,
        source_rows: summary.source_rows,
        inserted: created,
        ignored: skipped,
        errors,
      });

      const filename = `relatorio-importacao-inventario-${summary.inventory_id || 'novo'}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      doc.pipe(res);
      return;
    }

    return res.status(errors.length ? 207 : 200).json({
      ...summary,
      can_generate_pdf: true,
    });
  } catch (err) {
    logRootError('importInventoryXls error', err);

    if (err?.httpStatus) {
      return res.status(err.httpStatus).json({
        ok: false,
        error: err.message,
      });
    }

    return next(err);
  } finally {
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (unlinkErr) {
        console.warn('[inventoryController] failed to remove temp upload:', unlinkErr?.message);
      }
    }
  }
}

/* ========================================================================== */
/* Finalize / Logs / Reopen                                                   */
/* ========================================================================== */

export async function finalizeInventory(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid inventory id' });
    }

    const applyAdjust = req.body?.applyAdjust !== false;
    const userCtx = getUserCtx(req);

    const requiredPass = String(process.env.INVENTORY_FINALIZE_PASSWORD || '').trim();
    if (!requiredPass) {
      return res.status(500).json({
        ok: false,
        error: 'Finalize password not configured. Set INVENTORY_FINALIZE_PASSWORD in your environment.',
      });
    }

    const provided = String(req.body?.password || '').trim();
    if (!provided || provided !== requiredPass) {
      return res.status(401).json({ ok: false, error: 'Senha inválida.' });
    }

    const inv = await svc.finalizeInventory(id, { applyAdjust, userCtx });
    return res.json(inv);
  } catch (err) {
    return next(err);
  }
}

export async function listLogs(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid inventory id' });
    }

    const { dateFrom, dateTo, userName, productCode } = req.query || {};

    const rows = await svc.listLogs({
      inventory_id: id,
      dateFrom,
      dateTo,
      userName,
      productCode,
    });

    return res.json({ rows });
  } catch (err) {
    return next(err);
  }
}

export async function reopenInventory(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid inventory id' });
    }

    const requiredPass = String(process.env.INVENTORY_FINALIZE_PASSWORD || '').trim();
    if (!requiredPass) {
      return res.status(500).json({
        ok: false,
        error: 'Reopen password not configured. Set INVENTORY_FINALIZE_PASSWORD in your environment.',
      });
    }

    const provided = String(req.body?.password || '').trim();
    if (!provided || provided !== requiredPass) {
      return res.status(401).json({ ok: false, error: 'Senha inválida.' });
    }

    const userCtx = getUserCtx(req);
    const inv = await svc.reopenInventory(id, { userCtx });
    if (!inv) {
      return res.status(404).json({ ok: false, error: 'Inventory not found' });
    }

    return res.json(inv);
  } catch (err) {
    return next(err);
  }
}

export async function downloadInventoryReportPdf(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid inventory id' });
    }

    const inventory = await svc.getById(id);
    if (!inventory) {
      return res.status(404).json({ ok: false, error: 'Inventory not found' });
    }

    const items = await svc.listItems(id);

    const doc = generateInventoryImportReportPdf({
      inventory_id: inventory.inventory_id,
      inventory_code: inventory.code,
      inventory_description: inventory.description,
      filename: `Inventario-${inventory.inventory_id}`,
      user_name: null,
      source_rows: items.length,
      inserted: items.map((it, index) => {
        const oldStock = Number(it.system_stock_qty ?? 0);
        const counted = Number(it.counted_qty ?? 0);
        const diff = counted - oldStock;

        return {
          line: index + 1,
          barcode: it.barcode || it.product_barcode || it.ean || null,
          product_code: it.product_code,
          product_name: it.product_name,
          unit: it.unit,

          system_stock_qty: oldStock,
          counted_qty: counted,
          difference_qty: diff,
          new_stock_qty: counted,

          location_name: it.location_name,
          lot_code: it.lot_code,
          item_id: it.inventory_item_id,
        };
      }),
      ignored: [],
      errors: [],
    });

    const filename = `relatorio-inventario-${inventory.inventory_id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);
  } catch (err) {
    return next(err);
  }
}

/* ========================================================================== */
/* Aliases compatíveis com as rotas                                           */
/* ========================================================================== */

export const listInventories = list;
export const getInventoryById = getById;
export const createInventory = create;
export const updateInventory = update;
export const deleteInventory = remove;

export const listInventoryItems = listItems;
export const upsertInventoryItem = addItem;
export const deleteInventoryItem = removeItem;

export const reopenInventoryById = reopenInventory;
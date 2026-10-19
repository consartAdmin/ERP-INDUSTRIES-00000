// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryBarcode.repository.js — Resolução por código de barras    ║
// ║ resolveProductByBarcode / resolveInventoryPayloadFromBarcode       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_LOTS } from './inventory.constants.js';
import { q } from './inventory.utils.js';
import { toIntOrNull } from './inventory.sanitizers.js';
import {
  hasCol,
  qIdent,
  getProductsLocationsIdCol,
  getProductsLocationsDefaultCol,
} from './inventorySchemaInfo.repository.js';

// ──────────────────────────────────────────────────────────────
// BARCODE RESOLUTION
// ──────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────
// BARCODE RESOLUTION
// ──────────────────────────────────────────────────────────────
export async function resolveProductByBarcode(barcode, clientOrPool = pool) {
  const cleanBarcode = String(barcode || '').trim();
  if (!cleanBarcode) return null;

  const onlyNums = cleanBarcode.replace(/\D+/g, '');
  if (!onlyNums) return null;

  const { rows } = await q(
    clientOrPool,
    'barcode.resolve.productsBarCode',
    `
    SELECT
      pbc.barcode_id,
      pbc.barcode,
      pbc.product_code,
      pbc.product_unit_id,
      pbc.unit,
      pbc.fator,
      pbc.description AS unit_description,
      pbc.standard,
      pbc.is_active,
      pbc.unit_id,
      p.product_id,
      p.description AS product_name,
      p.product_stock_id
    FROM public."productsBarCode" pbc
    JOIN public."products" p
      ON p.product_code = pbc.product_code
    WHERE REGEXP_REPLACE(COALESCE(pbc.barcode, ''), '\\D', '', 'g') = $1
    ORDER BY
      COALESCE(pbc.is_active, FALSE) DESC,
      COALESCE(pbc.standard, FALSE) DESC,
      pbc.barcode_id DESC
    LIMIT 1;
    `,
    [onlyNums],
  );

  return rows[0] || null;
}

export async function resolveInventoryPayloadFromBarcode(
  barcode,
  partialPayload = {},
  clientOrPool = pool,
) {
  const resolved = await resolveProductByBarcode(barcode, clientOrPool);
  if (!resolved) return null;

  const productCode = String(resolved.product_code || '').trim();
  if (!productCode) return null;

  let productUnitId =
    toIntOrNull(partialPayload.product_unit_id) ??
    toIntOrNull(resolved.product_unit_id);

  let productLocationId = toIntOrNull(partialPayload.product_location_id);
  let lotId = toIntOrNull(partialPayload.lot_id);

  if (!productLocationId) {
    const plIdCol = await getProductsLocationsIdCol(clientOrPool);
    const plDefaultCol = await getProductsLocationsDefaultCol(clientOrPool);
    const plHasActive = await hasCol('public', 'productsLocations', 'is_active', clientOrPool);

    const { rows: locRows } = await q(
      clientOrPool,
      'barcode.resolve.default_location',
      `
      SELECT ${qIdent(plIdCol)} AS loc_id
      FROM public."productsLocations"
      WHERE product_code = $1
        ${plHasActive ? 'AND COALESCE(is_active, TRUE) IS TRUE' : ''}
      ORDER BY
        ${plDefaultCol ? `COALESCE(${qIdent(plDefaultCol)}, FALSE) DESC,` : ''}
        ${qIdent(plIdCol)} ASC
      LIMIT 1;
      `,
      [productCode],
    );

    productLocationId = toIntOrNull(locRows[0]?.loc_id);
  }

  if (!lotId && resolved.product_stock_id) {
    const { rows: lotRows } = await q(
      clientOrPool,
      'barcode.resolve.single_lot',
      `
      SELECT lot_id
      FROM ${TB_LOTS}
      WHERE product_stock_id = $1
      ORDER BY expires_at NULLS LAST, lot_id ASC;
      `,
      [resolved.product_stock_id],
    );

    if (lotRows.length === 1) {
      lotId = toIntOrNull(lotRows[0]?.lot_id);
    }
  }

  return {
    product_code: productCode,
    product_unit_id: productUnitId,
    product_location_id: productLocationId,
    lot_id: lotId,

    // qtd digitada/lida na planilha
    counted_qty: partialPayload.counted_qty,

    // fator da unidade vinda do productsBarCode
    fator: Number(resolved.fator ?? 1) || 1,
    unit: resolved.unit || null,

    notes: partialPayload.notes ?? null,
  };
}

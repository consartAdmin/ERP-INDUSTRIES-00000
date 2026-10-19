// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsUnitsLookup.repository.js — factorsBySkus / getByBarcode / listByProduct ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, UNITS_TB, PBC_TB, COLS } from './productsUnits.constants.js';
import { notEmptyStr, normBarcode, pickProductCodeFromParams } from './productsUnits.sanitizers.js';
import { mapRow } from './productsUnits.mappers.js';
import { buildBarcodeSelect, buildDescriptionSelect } from './productsUnits.sql.js';
import { getPuProductCol, checkBarcodeColumn, checkPbcColumns } from './productsUnitsCatalog.repository.js';
import { resolveIncomingProductCodeMaybeId } from './productsUnitsResolve.repository.js';

/* ──────────────────────────────────────────────────────────────────────────────
   Extras: factorsBySkus / getByBarcode / listByProduct
───────────────────────────────────────────────────────────────────────────── */
export async function factorsBySkus(skus = []) {
  const list = (Array.isArray(skus) ? skus : [])
    .map(s => String(s || '').trim())
    .filter(Boolean)
    .slice(0, 500);

  if (!list.length) return [];

  const puProductCol = await getPuProductCol();

  const { rows } = await pool.query(
    `
      SELECT
        pu.${puProductCol} AS sku,
        UPPER(BTRIM(pu.${COLS.unit})) AS unit,
        COALESCE(pu.${COLS.fator}, 1)::numeric AS factor,
        COALESCE(pu.${COLS.standard}, FALSE) AS standard
      FROM public.${TB} pu
      WHERE pu.${puProductCol} = ANY($1::text[])
        AND pu.${COLS.is_active} IS DISTINCT FROM FALSE
      ORDER BY pu.${puProductCol}, COALESCE(pu.${COLS.standard}, FALSE) DESC, UPPER(BTRIM(pu.${COLS.unit})) ASC
    `,
    [list]
  );

  return rows.map(r => ({
    sku: String(r.sku || '').trim(),
    unit: String(r.unit || '').trim(),
    factor: Number(r.factor ?? 1) || 1,
    standard: !!r.standard,
  }));
}

export async function getFactorsMapBySkus(skus = []) {
  return await factorsBySkus(skus);
}

export async function getByBarcode(barcode, { product_code, product_id } = {}) {
  const bc = normBarcode(barcode);
  if (!bc) return null;

  let code = pickProductCodeFromParams({ product_code, product_id });
  if (notEmptyStr(code)) code = await resolveIncomingProductCodeMaybeId(code);

  const puProductCol = await getPuProductCol();
  const descriptionSelect = buildDescriptionSelect();

  const { hasBarcodeId } = await checkPbcColumns();
  const orderBarcodeId = hasBarcodeId ? `, b.barcode_id DESC` : ``;

  const values = [bc];
  let i = 2;

  let extra = '';
  if (notEmptyStr(code)) {
    extra = ` AND pu.${puProductCol} = $${i++}`;
    values.push(code);
  }

  const { rows } = await pool.query(
    `
      SELECT
        pu.${COLS.id}        AS product_unit_id,
        pu.${puProductCol}   AS product_code,
        pu.${COLS.unit_id}   AS unit_id,
        pu.${COLS.unit}      AS unit,
        pu.${COLS.fator}     AS fator,
        ${descriptionSelect},
        b.barcode            AS barcode,
        pu.${COLS.standard}  AS standard,
        pu.${COLS.is_active} AS is_active,
        pu.${COLS.created_at} AS created_at,
        pu.${COLS.updated_at} AS updated_at
      FROM public.${PBC_TB} b
      JOIN public.${TB} pu
        ON pu.${COLS.id} = b.product_unit_id
      LEFT JOIN public.${UNITS_TB} u
        ON u.unit_id = pu.${COLS.unit_id}
      WHERE b.barcode = $1
        AND COALESCE(b.is_active, TRUE) IS TRUE
        AND pu.${COLS.is_active} IS DISTINCT FROM FALSE
        ${extra}
      ORDER BY COALESCE(pu.${COLS.standard}, FALSE) DESC, b.updated_at DESC${orderBarcodeId}
      LIMIT 1;
    `,
    values
  );

  if (rows[0]) return mapRow(rows[0]);

  const hasBarcode = await checkBarcodeColumn();
  if (!hasBarcode) return null;

  // fallback: productsUnits.barcode (legado)
  const values2 = [bc];
  let j = 2;

  let extra2 = '';
  if (notEmptyStr(code)) {
    extra2 = ` AND pu.${puProductCol} = $${j++}`;
    values2.push(code);
  }

  const { rows: rows2 } = await pool.query(
    `
      SELECT
        pu.${COLS.id}        AS product_unit_id,
        pu.${puProductCol}   AS product_code,
        pu.${COLS.unit_id}   AS unit_id,
        pu.${COLS.unit}      AS unit,
        pu.${COLS.fator}     AS fator,
        ${descriptionSelect},
        pu.${COLS.barcode}   AS barcode,
        pu.${COLS.standard}  AS standard,
        pu.${COLS.is_active} AS is_active,
        pu.${COLS.created_at} AS created_at,
        pu.${COLS.updated_at} AS updated_at
      FROM public.${TB} pu
      LEFT JOIN public.${UNITS_TB} u
        ON u.unit_id = pu.${COLS.unit_id}
      WHERE pu.${COLS.is_active} IS DISTINCT FROM FALSE
        AND pu.${COLS.barcode} = $1
        ${extra2}
      ORDER BY COALESCE(pu.${COLS.standard}, FALSE) DESC, pu.${COLS.updated_at} DESC
      LIMIT 1;
    `,
    values2
  );

  return mapRow(rows2[0] || null);
}

export async function listByProduct(product_code, { include_inactive = false } = {}) {
  let code = pickProductCodeFromParams({ product_code });
  if (!notEmptyStr(code)) return [];
  code = await resolveIncomingProductCodeMaybeId(code);

  const puProductCol = await getPuProductCol();
  const barcodeSelect = await buildBarcodeSelect();
  const descriptionSelect = buildDescriptionSelect();

  const { hasBarcodeId } = await checkPbcColumns();
  const pbcOrder = hasBarcodeId ? `b.updated_at DESC, b.barcode_id DESC` : `b.updated_at DESC`;

  const { rows } = await pool.query(
    `
      SELECT
        pu.${COLS.id}        AS product_unit_id,
        pu.${puProductCol}   AS product_code,
        pu.${COLS.unit_id}   AS unit_id,
        pu.${COLS.unit}      AS unit,
        pu.${COLS.fator}     AS fator,
        ${descriptionSelect},
        ${barcodeSelect},
        pu.${COLS.standard}  AS standard,
        pu.${COLS.is_active} AS is_active,
        pu.${COLS.created_at} AS created_at,
        pu.${COLS.updated_at} AS updated_at
      FROM public.${TB} pu
      LEFT JOIN public.${UNITS_TB} u
        ON u.unit_id = pu.${COLS.unit_id}
      LEFT JOIN LATERAL (
        SELECT b.barcode
        FROM public.${PBC_TB} b
        WHERE b.product_unit_id = pu.${COLS.id}
          AND COALESCE(b.is_active, TRUE) IS TRUE
        ORDER BY ${pbcOrder}
        LIMIT 1
      ) pbc ON TRUE
      WHERE pu.${puProductCol} = $1
        ${include_inactive ? '' : `AND pu.${COLS.is_active} IS DISTINCT FROM FALSE`}
      ORDER BY COALESCE(pu.${COLS.standard}, FALSE) DESC, UPPER(BTRIM(pu.${COLS.unit})) ASC;
    `,
    [String(code).trim()]
  );

  return rows.map(mapRow);
}

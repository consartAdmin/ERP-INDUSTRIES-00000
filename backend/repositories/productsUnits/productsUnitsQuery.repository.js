// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsUnitsQuery.repository.js — listProductsUnits / getProductsUnitById ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, UNITS_TB, PBC_TB, COLS } from './productsUnits.constants.js';
import { notEmptyStr, pickProductCodeFromParams } from './productsUnits.sanitizers.js';
import { mapRow } from './productsUnits.mappers.js';
import { sanitizeOrder, buildBarcodeSelect, buildDescriptionSelect } from './productsUnits.sql.js';
import { getPuProductCol, checkPbcColumns } from './productsUnitsCatalog.repository.js';
import { resolveIncomingProductCodeMaybeId } from './productsUnitsResolve.repository.js';

/* ──────────────────────────────────────────────────────────────────────────────
   LIST / GET
───────────────────────────────────────────────────────────────────────────── */
export async function listProductsUnits(params = {}) {
  const {
    q,

    // ✅ filtros de produto (padrão + compat)
    product_code, // padrão
    product_id,   // compat
    productId,    // compat
    sku,          // compat

    unit_id,
    standard,
    include_inactive = false,
    limit = 50,
    offset = 0,
    orderBy,
    dir = 'ASC',
  } = params;

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  // ✅ aceita qualquer alias: product_code / product_id / productId / sku
  let code = pickProductCodeFromParams({ product_code, product_id, productId, sku });
  if (notEmptyStr(code)) code = await resolveIncomingProductCodeMaybeId(code);

  const puProductCol = await getPuProductCol();
  const { orderBy: ob, dir: od } = sanitizeOrder(orderBy || COLS.unit, dir, puProductCol);

  const where = [];
  const values = [];
  let i = 1;

  if (!include_inactive) where.push(`pu.${COLS.is_active} IS DISTINCT FROM FALSE`);

  if (notEmptyStr(q)) {
    where.push(`LOWER(pu.${COLS.unit}) LIKE LOWER($${i++})`);
    values.push(`%${q.trim()}%`);
  }

  if (notEmptyStr(code)) {
    where.push(`pu.${puProductCol} = $${i++}`);
    values.push(code);
  }

  if (unit_id !== undefined && unit_id !== null && unit_id !== '') {
    const uid = Number(unit_id);
    if (!Number.isFinite(uid)) {
      const e = new Error('O campo "unit_id" deve ser numérico.');
      e.status = 400;
      throw e;
    }
    where.push(`pu.${COLS.unit_id} = $${i++}`);
    values.push(uid);
  }

  if (standard === true || standard === 'true' || standard === false || standard === 'false') {
    where.push(`pu.${COLS.standard} = $${i++}`);
    values.push(standard === true || standard === 'true');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const barcodeSelect = await buildBarcodeSelect();
  const descriptionSelect = buildDescriptionSelect();

  const { hasBarcodeId } = await checkPbcColumns();
  const pbcOrder = hasBarcodeId ? `b.updated_at DESC, b.barcode_id DESC` : `b.updated_at DESC`;

  const sql = `
    SELECT
      pu.${COLS.id}                         AS product_unit_id,
      pu.${puProductCol}                    AS product_code,
      pu.${COLS.unit_id}                    AS unit_id,
      pu.${COLS.unit}                       AS unit,
      pu.${COLS.fator}                      AS fator,
      ${descriptionSelect},
      ${barcodeSelect},
      pu.${COLS.standard}                   AS standard,
      pu.${COLS.is_active}                  AS is_active,
      pu.${COLS.created_at}                 AS created_at,
      pu.${COLS.updated_at}                 AS updated_at
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
    ${whereSql}
    ORDER BY pu.${ob} ${od}
    LIMIT $${i++} OFFSET $${i++};
  `;

  values.push(safeLimit, safeOffset);

  const countSql = `
    SELECT COUNT(*)::INT AS total
    FROM public.${TB} pu
    ${whereSql};
  `;

  const [rowsRes, countRes] = await Promise.all([
    pool.query(sql, values),
    pool.query(countSql, values.slice(0, values.length - 2)),
  ]);

  return {
    rows: rowsRes.rows.map(mapRow),
    total: countRes.rows[0]?.total ?? 0,
    limit: safeLimit,
    offset: safeOffset,
  };
}

export async function getProductsUnitById(id) {
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
      WHERE pu.${COLS.id} = $1
      LIMIT 1;
    `,
    [id]
  );

  return mapRow(rows[0]);
}

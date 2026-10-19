// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsQuery.repository.js — list / search / getByCode / getCostMap ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { PRODUCTS_TABLE } from './products.catalog.js';
import {
  TABLE_STOCK,
  TABLE_BARCODES,
  TABLE_LOCATIONS,
  TABLE_LOTS,
  TABLE_INBOUND_ITEMS,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  SORT_COLUMNS,
} from './products.constants.js';
import { ProductsApiError } from './products.utils.js';
import { requiredProductCode, positiveInteger } from './products.sanitizers.js';
import { buildLocationExpression, coreSelectSql } from './products.sql.js';

export async function list(options = {}) {
    const page = positiveInteger(options.page, 1);
    const limit = Math.min(positiveInteger(options.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const offset = (page - 1) * limit;
    const sort = SORT_COLUMNS.has(options.sort) ? options.sort : 'product_code';
    const direction = String(options.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const where = [];
    const values = [];
    const add = (sql, value) => {
        values.push(value);
        where.push(sql.replace('?', `$${values.length}`));
    };

    if (options.active === true || options.active === false) {
        add('p.is_active = ?', options.active);
    } else if (options.active === 'true' || options.active === 'false') {
        add('p.is_active = ?', options.active === 'true');
    }

    const status = String(options.status ?? '').trim().toLowerCase();
    if (status === 'ativo') where.push('p.is_active IS TRUE');
    if (status === 'inativo') where.push('p.is_active IS FALSE');

    const q = String(options.q ?? '').trim();
    if (q) {
        values.push(`%${q}%`);
        const placeholder = `$${values.length}`;
        where.push(`(
      p.product_code ILIKE ${placeholder}
      OR p.description ILIKE ${placeholder}
      OR p.barcode ILIKE ${placeholder}
      OR p.manufacturer_ref ILIKE ${placeholder}
      OR EXISTS (
        SELECT 1 FROM ${TABLE_BARCODES} pb
        WHERE pb.product_code = p.product_code
          AND pb.is_active IS TRUE
          AND pb.barcode ILIKE ${placeholder}
      )
    )`);
    }

    const filters = [
        ['manufacturer_id', 'p.manufacturer_id'],
        ['supplier_id', 'p.supplier_id'],
        ['group_id', 'p.product_group_id'],
        ['subgroup_id', 'p.product_subgroup_id'],
    ];

    for (const [input, column] of filters) {
        const value = positiveInteger(options[input]);
        if (value !== null) add(`${column} = ?`, value);
    }

    // linked=true → com grupo vinculado | linked=false → sem grupo
    const linked = String(options.linked ?? '').trim().toLowerCase();
    if (linked === 'true') where.push('p.product_group_id IS NOT NULL');
    if (linked === 'false') where.push('p.product_group_id IS NULL');

    // stock=with → saldo > 0 | stock=without → saldo <= 0 (inclui negativos)
    // Subquery (e não o JOIN de ps) para valer também no countSql.
    const stock = String(options.stock ?? '').trim().toLowerCase();
    if (stock === 'with' || stock === 'without') {
        where.push(`COALESCE((
      SELECT ps_f.stock_qty FROM ${TABLE_STOCK} ps_f
      WHERE ps_f.product_stock_id = p.product_stock_id
    ), 0) ${stock === 'with' ? '>' : '<='} 0`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const listSql = coreSelectSql(
        whereSql,
        `ORDER BY p.${sort} ${direction}`,
        `LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    );
    const countSql = `SELECT COUNT(*)::int AS total FROM ${PRODUCTS_TABLE} p ${whereSql}`;

    const [rowsResult, countResult] = await Promise.all([
        pool.query(listSql, [...values, limit, offset]),
        pool.query(countSql, values),
    ]);

    return {
        page,
        limit,
        total: countResult.rows[0]?.total ?? 0,
        rows: rowsResult.rows,
    };
}

export async function search(options = {}) {
    return list({
        ...options,
        active: options.active ?? true,
    });
}

export async function getByCode(productCode, { client = pool } = {}) {
    const code = requiredProductCode(productCode);

    const { rows } = await client.query(
        `
      SELECT
        p.*,
        COALESCE(ps.stock_qty, 0) AS stock_qty,
        COALESCE(ps.stock_min, 0) AS stock_min,
        COALESCE(ps.stock_max, 0) AS stock_max,
        loc.location_description,
        COALESCE(lots_data.lots, '[]'::jsonb) AS lots
      FROM ${PRODUCTS_TABLE} p
      LEFT JOIN ${TABLE_STOCK} ps
        ON ps.product_stock_id = p.product_stock_id
      LEFT JOIN LATERAL (
        SELECT STRING_AGG(
          DISTINCT ${buildLocationExpression('pl')},
          ' | ' ORDER BY ${buildLocationExpression('pl')}
        ) AS location_description
        FROM ${TABLE_LOCATIONS} pl
        WHERE pl.product_code = p.product_code
          AND pl.is_active IS TRUE
      ) loc ON TRUE
      LEFT JOIN LATERAL (
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'lot_id', psl.lot_id,
            'product_stock_id', psl.product_stock_id,
            'product_grade_id', psl.product_grade_id,
            'lot_code', psl.lot_code,
            'expires_at', psl.expires_at,
            'qty_on_hand', psl.qty_on_hand,
            'qty_reserved', psl.qty_reserved,
            'qty_available', GREATEST(
              COALESCE(psl.qty_on_hand, 0) - COALESCE(psl.qty_reserved, 0), 0
            ),
            'cost_unit', psl.cost_unit,
            'supplier_id', psl.supplier_id,
            'nfe_key', psl.nfe_key,
            'nfe_item_seq', psl.nfe_item_seq,
            'is_active', psl.is_active,
            'created_at', psl.created_at,
            'updated_at', psl.updated_at,
            'inbound_item_id', inbound_data.inbound_item_id,
            'inbound_invoice_id', inbound_data.inbound_id,
            'inbound_quantity', inbound_data.quantity,
            'supplier_product_code', inbound_data.nf_product_code,
            'icms_cst', inbound_data.icms_cst,
            'icms_base', inbound_data.icms_base,
            'icms_rate', inbound_data.icms_rate,
            'icms_value', inbound_data.icms,
            'icms_st_base', inbound_data.icms_st_base,
            'icms_st_rate', inbound_data.icms_st_rate,
            'icms_st_value', inbound_data.icms_st_value
          ) ORDER BY psl.expires_at ASC NULLS LAST, psl.lot_id ASC
        ) AS lots
        FROM ${TABLE_LOTS} psl
        LEFT JOIN LATERAL (
          SELECT iii.*
          FROM ${TABLE_INBOUND_ITEMS} iii
          WHERE iii.lot_id = psl.lot_id
            AND iii.product_code = p.product_code
          ORDER BY iii.inbound_item_id DESC
          LIMIT 1
        ) inbound_data ON TRUE
        WHERE psl.product_stock_id = ps.product_stock_id
          AND psl.deleted_at IS NULL
      ) lots_data ON TRUE
      WHERE p.product_code = $1
      LIMIT 1
    `,
        [code],
    );

    if (!rows.length) {
        throw new ProductsApiError('Produto não encontrado.', {
            code: 'PRODUCT_NOT_FOUND',
            status: 404,
        });
    }

    return rows[0];
}

export async function getCostMap(codes = []) {
    const normalized = Array.isArray(codes)
        ? [...new Set(codes.map((value) => String(value).trim()).filter(Boolean))]
        : [];

    if (!normalized.length) return {};

    const { rows } = await pool.query(
        `
      SELECT product_code, cost_price
      FROM ${PRODUCTS_TABLE}
      WHERE product_code = ANY($1::text[])
    `,
        [normalized],
    );

    return Object.fromEntries(rows.map((row) => [
        String(row.product_code),
        Number(row.cost_price || 0),
    ]));
}

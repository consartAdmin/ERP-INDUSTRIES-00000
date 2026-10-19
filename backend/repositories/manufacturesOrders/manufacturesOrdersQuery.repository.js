// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturesOrdersQuery.repository.js — list / getById /           ║
// ║ listWithItems                                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ORDERS, TB_ITEMS } from './manufacturesOrders.constants.js';
import { toNumber, safeText } from './manufacturesOrders.sanitizers.js';

export async function list(params = {}) {
  const page = Math.max(toNumber(params.page, 1), 1);
  const pageSize = Math.min(Math.max(toNumber(params.pageSize, 100), 1), 500);
  const offset = (page - 1) * pageSize;

  const search = safeText(params.search, '');
  const status = safeText(params.status, '');

  const where = [];
  const values = [];

  if (search) {
    values.push(`%${search}%`);
    where.push(`(
      o.order_number ILIKE $${values.length}
      OR o.manufacturer_name ILIKE $${values.length}
      OR o.notes ILIKE $${values.length}
    )`);
  }

  if (status) {
    values.push(status);
    where.push(`o.status = $${values.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await pool.query(`
    SELECT
      o.*,
      COALESCE(ic.items_count, 0)::int AS items_count
    FROM ${TB_ORDERS} o
    LEFT JOIN (
      SELECT
        manufacture_order_id,
        COUNT(*)::int AS items_count
      FROM ${TB_ITEMS}
      GROUP BY manufacture_order_id
    ) ic ON ic.manufacture_order_id = o.manufacture_order_id
    ${whereSql}
    ORDER BY o.manufacture_order_id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `, [...values, pageSize, offset]);

  const count = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM ${TB_ORDERS} o
    ${whereSql}
  `, values);

  console.log('[manufacturesOrdersApi.list]', {
    total: count.rows[0]?.total || 0,
    rows_count: rows.length,
    ids: rows.map(r => r.manufacture_order_id),
  });

  return {
    rows,
    total: count.rows[0]?.total || 0,
    page,
    pageSize,
  };
}

export async function getById(id) {

  /* ╔══════════════════════════════════════════════════════════════╗
     ║ ORDER                                                       ║
     ╚══════════════════════════════════════════════════════════════╝ */

  const { rows } = await pool.query(`
    SELECT *
    FROM ${TB_ORDERS}
    WHERE manufacture_order_id = $1
    LIMIT 1
  `, [id]);

  const order = rows[0];

  if (!order) {
    return null;
  }

  /* ╔══════════════════════════════════════════════════════════════╗
     ║ ITEMS + STOCK                                                ║
     ╚══════════════════════════════════════════════════════════════╝ */

  const itemsResult = await pool.query(`
    SELECT
      i.*,

      /* PRODUCT */
      p.product_id,
      p.product_stock_id,

      /* STOCK */
      COALESCE(ps.stock_qty, 0)  AS stock_qty,
      COALESCE(ps.stock_min, 0)  AS stock_min,
      COALESCE(ps.stock_max, 0)  AS stock_max

    FROM ${TB_ITEMS} i

    LEFT JOIN public.products p
      ON p.product_code::text = i.product_code::text

    LEFT JOIN public."productsStock" ps
      ON ps.product_stock_id = p.product_stock_id

    WHERE i.manufacture_order_id = $1

    ORDER BY i.manufacture_order_item_id ASC
  `, [id]);

  return {
    ...order,
    items: itemsResult.rows,
  };
}

export async function listWithItems(params = {}) {
  const result = await list({
    ...params,
    pageSize: params.pageSize || 1000,
  });

  const rows = [];

  for (const order of result.rows || []) {
    const id = order.manufacture_order_id || order.id || order.order_id;
    const fullOrder = await getById(id);

    if (fullOrder) {
      rows.push(fullOrder);
    }
  }

  return {
    ...result,
    rows,
  };
}

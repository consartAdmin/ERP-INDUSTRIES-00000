// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersTotals.repository.js — getTotals                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ORDERS_PRIMARY_KEY } from './orders.catalog.js';
import { TB_ORDERS, TB_ORDER_ITEMS, TB_ORDER_SHIPPING } from './orders.constants.js';
import { qi } from './orders.sql.js';
import { ensureTables } from './ordersSchema.repository.js';

export async function getTotals(orderId) {
  await ensureTables();

  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'ID inválido' };
  }

  const sql = `
    SELECT
      (
        SELECT COUNT(*)
        FROM ${TB_ORDER_ITEMS} oi
        WHERE oi.order_id = o.order_id
      ) AS items_count,
      COALESCE(o.subtotal, 0) AS subtotal_amount,
      COALESCE(o.items_discount_total, 0) AS items_discount_total,
      COALESCE(o.global_discount_amount, 0) AS global_discount_amount,
      COALESCE(o.total_discount, 0) AS total_discount,
      COALESCE(os.freight_value, 0) AS freight_amount,
      COALESCE(o.total_amount, 0) AS total_amount
    FROM ${TB_ORDERS} o
    LEFT JOIN ${TB_ORDER_SHIPPING} os
      ON os.order_shipping_id = o.order_shipping_id
    WHERE o.${qi(ORDERS_PRIMARY_KEY)} = $1
  `;

  const r = await pool.query(sql, [id]);
  const row = r.rows?.[0];

  if (!row) return { ok: false, error: 'NOT_FOUND' };

  return {
    ok: true,
    items_count: Number(row.items_count || 0),
    subtotal_amount: Number(row.subtotal_amount || 0),
    items_discount_total: Number(row.items_discount_total || 0),
    global_discount_amount: Number(row.global_discount_amount || 0),
    total_discount: Number(row.total_discount || 0),
    freight_amount: Number(row.freight_amount || 0),
    total_amount: Number(row.total_amount || 0),
  };
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesReportOrderItems.repository.js — getSalesOrderItems           ║
// ║ Itens do pedido (ordersItems) ou orçamento (budgetsItems)          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ORDER_ITEMS, TB_BUDGET_ITEMS, TB_PRODUCTS } from './salesReport.constants.js';
import { costUnitPerItemSql } from './salesReport.sql.js';

export async function getSalesOrderItems(orderId, filters = {}) {
  const parsedOrderId = Number.parseInt(orderId, 10);
  if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0) {
    throw new TypeError('orderId inválido.');
  }

  const cost = costUnitPerItemSql(filters.costMode);
  const sql = `
    WITH invoice_items AS (
      SELECT
        oi_order.order_item_id::text AS item_id,
        oi_order.order_id,
        NULL::bigint AS budget_id,
        oi_order.product_code,
        oi_order.description,
        oi_order.unit_code,
        oi_order.conversion_factor,
        oi_order.quantity,
        oi_order.unit_price,
        oi_order.discount_value,
        to_jsonb(oi_order) ->> 'cost_price_at_sale' AS cost_price_at_sale
      FROM ${TB_ORDER_ITEMS} oi_order
      WHERE oi_order.order_id = $1

      UNION ALL

      SELECT
        bi.budget_item_id::text AS item_id,
        NULL::bigint AS order_id,
        bi.budget_id,
        bi.product_code,
        bi.description,
        bi.unit_code,
        bi.conversion_factor,
        bi.quantity,
        bi.unit_price,
        bi.discount_value,
        to_jsonb(bi) ->> 'cost_price_at_sale' AS cost_price_at_sale
      FROM ${TB_BUDGET_ITEMS} bi
      WHERE bi.budget_id = $1
    )
    SELECT
      oi.item_id AS order_item_id,
      COALESCE(oi.order_id, oi.budget_id) AS order_id,
      oi.budget_id,
      oi.product_code AS sku,
      COALESCE(oi.description, p.description, '') AS description,
      oi.unit_code AS unit,
      COALESCE(oi.quantity, 0) AS quantity,
      COALESCE(oi.unit_price, 0) AS unit_price,
      COALESCE(oi.discount_value, 0) AS discount_value,
      (${cost}) AS unit_cost,
      COALESCE(oi.quantity, 0) * (${cost}) AS total_cost,
      COALESCE(oi.quantity, 0) * COALESCE(oi.unit_price, 0)
        - COALESCE(oi.discount_value, 0) AS total_amount,
      COALESCE(oi.quantity, 0) * COALESCE(oi.unit_price, 0)
        - COALESCE(oi.discount_value, 0)
        - COALESCE(oi.quantity, 0) * (${cost}) AS gross_profit
    FROM invoice_items oi
    LEFT JOIN ${TB_PRODUCTS} p
      ON TRIM(p.product_code::text) = TRIM(oi.product_code::text)
    ORDER BY oi.item_id ASC;
  `;

  const { rows } = await pool.query(sql, [parsedOrderId]);
  return rows;
}

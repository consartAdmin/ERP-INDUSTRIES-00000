// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesReportQuery.repository.js — resumo / dia / cliente / produto  ║
// ║ / lista de notas (orders)                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_INVOICES,
  TB_ORDER_ITEMS,
  TB_BUDGET_ITEMS,
  TB_PRODUCTS,
} from './salesReport.constants.js';
import {
  NFE_STATUS_SQL,
  ISSUED_DATE_SQL,
  costUnitPerItemSql,
  baseFrom,
  invoiceItemsLateral,
  buildWhere,
  buildProductWhere,
} from './salesReport.sql.js';

export async function getSalesSummary(filters = {}) {
  const { whereSql, params } = buildWhere(filters);
  const cost = costUnitPerItemSql(filters.costMode);

  const sql = `
    WITH invoice_base AS (
      SELECT
        ii.invoice_id,
        ii.order_id,
        ii.budget_id,
        COALESCE(ii.total_amount, 0) AS invoice_total
      ${baseFrom()}
      ${whereSql}
    ),
    cost_base AS (
      SELECT
        ib.invoice_id,
        COALESCE(SUM(COALESCE(oi.quantity, 0)), 0) AS total_items,
        COALESCE(SUM(COALESCE(oi.quantity, 0) * (${cost})), 0) AS total_cost
      FROM invoice_base ib
      ${invoiceItemsLateral('ib', 'LEFT JOIN')}
      LEFT JOIN ${TB_PRODUCTS} p
        ON TRIM(p.product_code::text) = TRIM(oi.product_code::text)
      GROUP BY ib.invoice_id
    )
    SELECT
      COUNT(DISTINCT ib.invoice_id) AS orders_count,
      COALESCE(SUM(cb.total_items), 0) AS total_items,
      COALESCE(SUM(ib.invoice_total), 0) AS total_amount,
      COALESCE(SUM(cb.total_cost), 0) AS total_cost,
      COALESCE(SUM(ib.invoice_total), 0) - COALESCE(SUM(cb.total_cost), 0) AS gross_profit
    FROM invoice_base ib
    LEFT JOIN cost_base cb
      ON cb.invoice_id = ib.invoice_id;
  `;

  const { rows } = await pool.query(sql, params);
  return rows[0] || {};
}

export async function getSalesByDay(filters = {}) {
  const { whereSql, params } = buildWhere(filters);
  const sql = `
    SELECT
      ${ISSUED_DATE_SQL} AS day,
      COUNT(DISTINCT ii.invoice_id) AS orders_count,
      COALESCE(SUM((
        SELECT SUM(item_quantity)
        FROM (
          SELECT COALESCE(oi_order.quantity, 0) AS item_quantity
          FROM ${TB_ORDER_ITEMS} oi_order
          WHERE oi_order.order_id = ii.order_id
          UNION ALL
          SELECT COALESCE(bi.quantity, 0) AS item_quantity
          FROM ${TB_BUDGET_ITEMS} bi
          WHERE bi.budget_id = ii.budget_id
        ) invoice_quantities
      )), 0) AS total_items,
      COALESCE(SUM(ii.total_amount), 0) AS total_amount
    ${baseFrom()}
    ${whereSql}
    GROUP BY ${ISSUED_DATE_SQL}
    ORDER BY day ASC;
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function getSalesByCustomer(filters = {}) {
  const { whereSql, params } = buildWhere(filters);
  const sql = `
    SELECT
      COALESCE(o.customer_id, b.customer_id) AS customer_id,
      COALESCE(o.customer_name, b.customer_name, ii.customer_name, '') AS customer_name,
      COUNT(DISTINCT ii.invoice_id) AS orders_count,
      COALESCE(SUM(ii.total_amount), 0) AS total_amount
    ${baseFrom()}
    ${whereSql}
    GROUP BY
      COALESCE(o.customer_id, b.customer_id),
      COALESCE(o.customer_name, b.customer_name, ii.customer_name, '')
    ORDER BY total_amount DESC, customer_name ASC;
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function getSalesByProduct(filters = {}) {
  const { whereSql, params: baseParams } = buildWhere(filters);
  const { productWhereSql, params } = buildProductWhere(filters, baseParams);
  const cost = costUnitPerItemSql(filters.costMode);

  const sql = `
    SELECT
      oi.product_code AS product_sku,
      COALESCE(oi.description, p.description, '') AS product_description,
      NULLIF(UPPER(TRIM(oi.unit_code)), '') AS product_unit,
      COALESCE(SUM(oi.quantity), 0) AS total_items,
      COALESCE(SUM(
        COALESCE(oi.quantity, 0) * COALESCE(oi.unit_price, 0)
        - COALESCE(oi.discount_value, 0)
      ), 0) AS total_amount,
      COALESCE(SUM(COALESCE(oi.quantity, 0) * (${cost})), 0) AS total_cost,
      COALESCE(SUM(
        COALESCE(oi.quantity, 0) * COALESCE(oi.unit_price, 0)
        - COALESCE(oi.discount_value, 0)
      ), 0) - COALESCE(SUM(COALESCE(oi.quantity, 0) * (${cost})), 0) AS gross_profit,
      COALESCE(AVG(oi.unit_price), 0) AS avg_unit_price,
      CASE
        WHEN COALESCE(SUM(oi.quantity), 0) > 0
        THEN COALESCE(SUM(COALESCE(oi.quantity, 0) * (${cost})), 0) / SUM(oi.quantity)
        ELSE 0
      END AS avg_unit_cost
    ${baseFrom()}
    ${invoiceItemsLateral('ii', 'JOIN')}
    LEFT JOIN ${TB_PRODUCTS} p
      ON TRIM(p.product_code::text) = TRIM(oi.product_code::text)
    ${whereSql}
    ${productWhereSql}
    GROUP BY
      oi.product_code,
      COALESCE(oi.description, p.description, ''),
      NULLIF(UPPER(TRIM(oi.unit_code)), '')
    ORDER BY total_amount DESC, product_sku ASC;
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function getSalesOrders(filters = {}) {
  const { whereSql, params } = buildWhere(filters);
  const cost = costUnitPerItemSql(filters.costMode);

  const sql = `
    WITH cost_base AS (
      SELECT
        ii_cost.invoice_id,
        COALESCE(SUM(COALESCE(oi.quantity, 0)), 0) AS total_items,
        COALESCE(SUM(COALESCE(oi.quantity, 0) * (${cost})), 0) AS total_cost
      FROM ${TB_INVOICES} ii_cost
      ${invoiceItemsLateral('ii_cost', 'LEFT JOIN')}
      LEFT JOIN ${TB_PRODUCTS} p
        ON TRIM(p.product_code::text) = TRIM(oi.product_code::text)
      GROUP BY ii_cost.invoice_id
    )
    SELECT
      ii.invoice_id,
      COALESCE(ii.order_id, ii.budget_id) AS order_id,
      ii.order_id AS original_order_id,
      ii.budget_id,
      COALESCE(
        ii.source_type,
        CASE WHEN ii.budget_id IS NOT NULL THEN 'BUDGET' ELSE 'ORDER' END
      ) AS source_type,
      ii.nfe_number,
      ii.nfe_key,
      ${NFE_STATUS_SQL} AS nfe_status,
      ${ISSUED_DATE_SQL} AS issued_date,
      COALESCE(ii.total_amount, 0) AS total_amount,
      COALESCE(ii.order_id, ii.budget_id)::text AS order_number,
      COALESCE(o.customer_name, b.customer_name, ii.customer_name, '') AS customer_name,
      COALESCE(o.customer_tax_id, b.customer_tax_id, ii.customer_tax_id) AS customer_tax_id,
      COALESCE(cb.total_items, 0) AS total_items,
      COALESCE(cb.total_cost, 0) AS total_cost,
      COALESCE(ii.total_amount, 0) - COALESCE(cb.total_cost, 0) AS gross_profit
    ${baseFrom()}
    LEFT JOIN cost_base cb
      ON cb.invoice_id = ii.invoice_id
    ${whereSql}
    ORDER BY ${ISSUED_DATE_SQL} ASC, ii.invoice_id ASC;
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

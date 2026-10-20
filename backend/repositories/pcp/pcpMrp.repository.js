// ╔════════════════════════════════════════════════════════════════════╗
// ║ pcpMrp.repository.js — Necessidade de materiais (MRP simples)      ║
// ║ Soma o que falta consumir das OPs abertas e compara com o estoque. ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_ORDERS, TB_ORDER_MATERIALS, TB_PRODUCTS, TB_STOCK, TB_RAW_MATERIALS, OPEN_STATUSES,
} from './pcp.constants.js';

export async function materialNeeds({ onlyShortage = 'false' } = {}) {
  const { rows } = await pool.query(
    `WITH need AS (
       SELECT m.raw_material_id, m.component_code,
              SUM(GREATEST(m.qty_per_unit * (o.quantity_planned - o.quantity_produced), 0)) AS qty_needed,
              COUNT(DISTINCT o.order_id)::int AS orders_count,
              MIN(o.due_date) AS first_due_date
         FROM ${TB_ORDER_MATERIALS} m
         JOIN ${TB_ORDERS} o ON o.order_id = m.order_id
        WHERE o.status = ANY($1)
        GROUP BY m.raw_material_id, m.component_code
     ),
     stock AS (
       SELECT n.*,
              CASE WHEN n.raw_material_id IS NOT NULL THEN 'raw' ELSE 'product' END AS component_source,
              COALESCE(rm.code, n.component_code) AS code,
              COALESCE(rm.description, p.description) AS description,
              rm.unit,
              COALESCE(rm.stock_qty, s.stock_qty, 0) AS stock_qty,
              COALESCE(rm.min_stock, s.stock_min, 0) AS stock_min,
              COALESCE(NULLIF(rm.average_cost, 0), rm.last_cost, p.cost_price, 0) AS cost_price
         FROM need n
         LEFT JOIN ${TB_RAW_MATERIALS} rm ON rm.raw_material_id = n.raw_material_id
         LEFT JOIN ${TB_PRODUCTS} p ON p.product_code = n.component_code AND n.raw_material_id IS NULL
         LEFT JOIN ${TB_STOCK} s ON s.product_stock_id = p.product_stock_id
     )
     SELECT st.*, st.code AS component_code,
            GREATEST(st.qty_needed + st.stock_min - st.stock_qty, 0) AS qty_to_buy
       FROM stock st
      ORDER BY (GREATEST(st.qty_needed + st.stock_min - st.stock_qty, 0) > 0) DESC,
               st.first_due_date NULLS LAST, st.code`,
    [OPEN_STATUSES]
  );
  return String(onlyShortage) === 'true' ? rows.filter((r) => Number(r.qty_to_buy) > 0) : rows;
}

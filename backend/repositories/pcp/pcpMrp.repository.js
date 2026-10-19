// ╔════════════════════════════════════════════════════════════════════╗
// ║ pcpMrp.repository.js — Necessidade de materiais (MRP simples)      ║
// ║ Soma o que falta consumir das OPs abertas e compara com o estoque. ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ORDERS, TB_ORDER_MATERIALS, TB_PRODUCTS, TB_STOCK, OPEN_STATUSES } from './pcp.constants.js';

export async function materialNeeds({ onlyShortage = 'false' } = {}) {
  const { rows } = await pool.query(
    `WITH need AS (
       SELECT m.component_code,
              SUM(GREATEST(m.qty_per_unit * (o.quantity_planned - o.quantity_produced), 0)) AS qty_needed,
              COUNT(DISTINCT o.order_id)::int AS orders_count,
              MIN(o.due_date) AS first_due_date
         FROM ${TB_ORDER_MATERIALS} m
         JOIN ${TB_ORDERS} o ON o.order_id = m.order_id
        WHERE o.status = ANY($1)
        GROUP BY m.component_code
     )
     SELECT n.*, p.description,
            COALESCE(s.stock_qty, 0) AS stock_qty,
            COALESCE(s.stock_min, 0) AS stock_min,
            GREATEST(n.qty_needed + COALESCE(s.stock_min, 0) - COALESCE(s.stock_qty, 0), 0) AS qty_to_buy,
            COALESCE(p.cost_price, 0) AS cost_price
       FROM need n
       LEFT JOIN ${TB_PRODUCTS} p ON p.product_code = n.component_code
       LEFT JOIN ${TB_STOCK} s ON s.product_stock_id = p.product_stock_id
      ORDER BY (GREATEST(n.qty_needed + COALESCE(s.stock_min, 0) - COALESCE(s.stock_qty, 0), 0) > 0) DESC,
               n.first_due_date NULLS LAST, n.component_code`,
    [OPEN_STATUSES]
  );
  return String(onlyShortage) === 'true' ? rows.filter((r) => Number(r.qty_to_buy) > 0) : rows;
}

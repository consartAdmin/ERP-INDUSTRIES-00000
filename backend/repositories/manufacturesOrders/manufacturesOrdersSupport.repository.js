// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturesOrdersSupport.repository.js — Número do pedido,        ║
// ║ recálculo do total e resolução do produto via productsStock        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import productsStockApi from '../productsStock/productsStock.manager.js';
import { TB_ORDERS, TB_ITEMS } from './manufacturesOrders.constants.js';

export async function generateOrderNumber(client) {
  const year = new Date().getFullYear();

  const { rows } = await client.query(`
    SELECT COUNT(*)::int + 1 AS next_number
    FROM ${TB_ORDERS}
    WHERE EXTRACT(YEAR FROM created_at) = $1
  `, [year]);

  const seq = String(rows[0]?.next_number || 1).padStart(5, '0');
  return `MF-${year}-${seq}`;
}

export async function recalcTotal(client, manufactureOrderId) {
  const { rows } = await client.query(`
    UPDATE ${TB_ORDERS} o
       SET total_cost = COALESCE((
         SELECT ROUND(SUM(i.quantity * i.cost_price)::numeric, 2)
         FROM ${TB_ITEMS} i
         WHERE i.manufacture_order_id = o.manufacture_order_id
       ), 0),
       updated_at = NOW()
     WHERE o.manufacture_order_id = $1
     RETURNING *
  `, [manufactureOrderId]);

  return rows[0];
}

export async function resolveProductFromStock(productStockId) {
  if (!productStockId) return null;

  if (typeof productsStockApi.getById === 'function') {
    const row = await productsStockApi.getById(productStockId);
    return row?.data || row || null;
  }

  const { rows } = await pool.query(`
    SELECT 
      ps.product_stock_id,
      ps.product_code,
      p.sku,
      p.description,
      p.name,
      p.unit,
      p.cost_price
    FROM public."productsStock" ps
    LEFT JOIN public.products p 
      ON p.product_code::text = ps.product_code::text
    WHERE ps.product_stock_id = $1
    LIMIT 1
  `, [productStockId]);

  return rows[0] || null;
}

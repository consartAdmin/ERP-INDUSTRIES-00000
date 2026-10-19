// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrderItemsQuery.repository.js — listItems / por pedido    ║
// ║ Tabela: "ecommerceOrderItems"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q, parseOrder } from './ecommerceOrderItems.utils.js';
import { buildItemsWhere } from './ecommerceOrderItems.sql.js';

/* =========================================================================
   LISTAGEM / BUSCA
============================================================================*/

export async function listItems({
  order_id,
  product_code,
  search,
  limit = 200,
  offset = 0,
  orderBy = 'id ASC',
}) {
  const allowedOrder = ['id', 'order_id', 'product_code', 'name'];
  const order = parseOrder(orderBy, allowedOrder);

  const { sqlWhere, params } = buildItemsWhere({
    order_id,
    product_code,
    search,
  });

  const sql = `
    SELECT
      id,
      order_id,
      product_id,
      product_code,
      name,
      unit,
      qty,
      price,
      total
    FROM "ecommerceOrderItems" i
    ${sqlWhere}
    ${order}
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;
  const res = await q(sql, [...params, Number(limit), Number(offset)]);

  const countSql = `
    SELECT COUNT(*) AS total
    FROM "ecommerceOrderItems" i
    ${sqlWhere}
  `;
  const countRes = await q(countSql, params);

  return {
    items: res.rows,
    total: Number(countRes.rows?.[0]?.total || 0),
    limit: Number(limit),
    offset: Number(offset),
  };
}

/**
 * Compat com controller: retorna apenas os itens do pedido (array)
 */
export async function getItemsByOrderId(order_id) {
  const { items } = await listItems({ order_id, limit: 1000, offset: 0, orderBy: 'id ASC' });
  return items;
}

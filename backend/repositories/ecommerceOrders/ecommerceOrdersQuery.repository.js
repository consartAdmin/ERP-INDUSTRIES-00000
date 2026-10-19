// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrdersQuery.repository.js — listOrders / searchOrders     ║
// ║ Tabela: "ecommerceOrders"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q, parseOrder } from './ecommerceOrders.utils.js';
import { buildOrdersWhere } from './ecommerceOrders.sql.js';

/* =========================================================================
   LISTAGEM / BUSCA
============================================================================*/

/**
 * Lista pedidos para grid, com paginação + total
 */
export async function listOrders({
  date_from,
  date_to,
  billingType,
  status,       // 🔹 novo filtro opcional
  qText,
  limit = 50,
  offset = 0,
  orderBy = 'created_at DESC',
}) {
  const allowedOrder = ['created_at', 'subtotal', 'shipping_value', 'id'];
  const order = parseOrder(orderBy, allowedOrder);

  const { sqlWhere, params } = buildOrdersWhere({
    date_from,
    date_to,
    billingType,
    status,
    qText,
  });

  const sql = `
    SELECT
      id,
      subtotal,
      created_at,
      asaas_payment_id,
      asaas_invoice_url,
      asaas_pix_qr_code,
      asaas_pix_qr_code_url,
      asaas_billing_type,
      asaas_status,
      shipping_value,
      shipping_free,
      shipping_rule,
      shipping_service,
      shipping_provider
    FROM "ecommerceOrders" o
    ${sqlWhere}
    ${order}
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;
  const res = await q(sql, [...params, Number(limit), Number(offset)]);

  const countSql = `
    SELECT COUNT(*) AS total
    FROM "ecommerceOrders" o
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
 * Versão simplificada para controller que só quer o array
 */
export async function searchOrders(filters = {}) {
  const { items } = await listOrders(filters);
  return items;
}

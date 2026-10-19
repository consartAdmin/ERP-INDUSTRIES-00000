// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrdersGetById.repository.js — getOrderById                ║
// ║ Tabela: "ecommerceOrders"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './ecommerceOrders.utils.js';

/* =========================================================================
   GET POR ID
============================================================================*/

export async function getOrderById(id) {
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
    FROM "ecommerceOrders"
    WHERE id = $1
  `;
  const res = await q(sql, [id]);
  return res.rows[0] || null;
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrdersUpdate.repository.js — updateOrder                  ║
// ║ Tabela: "ecommerceOrders"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './ecommerceOrders.utils.js';
import { getOrderById } from './ecommerceOrdersGetById.repository.js';

export async function updateOrder(id, payload = {}) {
  const cols = [
    'subtotal',
    'asaas_payment_id',
    'asaas_invoice_url',
    'asaas_pix_qr_code',
    'asaas_pix_qr_code_url',
    'asaas_billing_type',
    'asaas_status',      // 🔹 novo
    'shipping_value',
    'shipping_free',
    'shipping_rule',
    'shipping_service',
    'shipping_provider',
  ];

  const sets = [];
  const params = [];
  let i = 1;

  for (const c of cols) {
    if (payload[c] === undefined) continue;

    sets.push(`${c} = $${i++}`);
    if (c === 'shipping_free') {
      params.push(payload[c] === null ? null : !!payload[c]);
    } else {
      params.push(payload[c]);
    }
  }

  if (!sets.length) {
    return getOrderById(id);
  }

  const sql = `
    UPDATE "ecommerceOrders"
       SET ${sets.join(', ')}
     WHERE id = $${i}
    RETURNING *
  `;
  const res = await q(sql, [...params, id]);
  return res.rows[0] || null;
}

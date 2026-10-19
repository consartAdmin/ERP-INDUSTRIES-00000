// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrdersCreate.repository.js — createOrder                  ║
// ║ Tabela: "ecommerceOrders"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './ecommerceOrders.utils.js';

export async function createOrder(payload = {}) {
  const cols = [
    'subtotal',
    'created_at',
    'asaas_payment_id',
    'asaas_invoice_url',
    'asaas_pix_qr_code',
    'asaas_pix_qr_code_url',
    'asaas_billing_type',
    'asaas_status',       // 🔹 novo
    'shipping_value',
    'shipping_free',
    'shipping_rule',
    'shipping_service',
    'shipping_provider',
  ];

  const insertCols = [];
  const vals = [];
  const params = [];
  let i = 1;

  for (const c of cols) {
    const v = payload[c];
    if (v === undefined) continue;

    insertCols.push(c);
    if (c === 'shipping_free') {
      vals.push(`$${i++}`);
      params.push(v === null ? null : !!v);
    } else if (c === 'created_at' && v === 'NOW()') {
      // se quiser mandar literal, mas normalmente deixamos o default
      insertCols.pop(); // não adiciona
    } else {
      vals.push(`$${i++}`);
      params.push(v);
    }
  }

  if (!insertCols.length) {
    // deixa que o banco use defaults (ex: created_at)
    insertCols.push('created_at');
    vals.push(`NOW()`);
  }

  const sql = `
    INSERT INTO "ecommerceOrders" (${insertCols.join(',')})
    VALUES (${vals.join(',')})
    RETURNING *
  `;
  const res = await q(sql, params);
  return res.rows[0];
}

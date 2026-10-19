// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ lockInvoiceForPost.repository.js — CONSART ERP | Notas de Entrada       ║
// ║ SELECT ... FOR UPDATE do cabeçalho antes da postagem                      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { TB_INVOICES } from './_shared.js';

export async function lockInvoiceForPost(client, invoiceId) {
  const res = await client.query(
    `
      SELECT inbound_id, status, stock_applied, access_key, invoice_number, series,
             issuer, recipient, total_amount
        FROM ${TB_INVOICES}
       WHERE inbound_id = $1
       FOR UPDATE
    `,
    [invoiceId]
  );

  return res.rows[0] || null;
}

export default lockInvoiceForPost;

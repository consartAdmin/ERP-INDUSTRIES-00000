// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ markInvoicePosted.repository.js — CONSART ERP | Notas de Entrada        ║
// ║ Marca a nota como POSTED e o estoque como aplicado                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { TB_INVOICES } from './_shared.js';

export async function markInvoicePosted(client, invoiceId) {
  const res = await client.query(
    `
      UPDATE ${TB_INVOICES}
         SET status = 'POSTED',
             stock_applied = TRUE,
             stock_applied_at = NOW()
       WHERE inbound_id = $1
       RETURNING *
    `,
    [invoiceId]
  );

  return res.rows[0] || null;
}

export default markInvoicePosted;

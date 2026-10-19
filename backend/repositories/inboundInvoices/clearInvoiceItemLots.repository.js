// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ clearInvoiceItemLots.repository.js — CONSART ERP                        ║
// ║ Remove lot_id dos itens quando PRODUCT_STOCK_MODE = STOCK_SIMPLE         ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { TB_III } from './_shared.js';

export async function clearInvoiceItemLots(client, invoiceId) {
  const result = await client.query(
    `
      UPDATE ${TB_III}
         SET lot_id = NULL,
             updated_at = NOW()
       WHERE inbound_id = $1
         AND lot_id IS NOT NULL
      RETURNING inbound_item_id
    `,
    [invoiceId],
  );

  return result.rows || [];
}

export default clearInvoiceItemLots;

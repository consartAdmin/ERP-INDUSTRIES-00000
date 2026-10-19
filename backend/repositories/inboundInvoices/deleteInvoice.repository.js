// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ deleteInvoice.repository.js — CONSART ERP | Notas de Entrada            ║
// ║ Remove a nota de entrada pelo inbound_id                                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  TB_INVOICES,
  q,
} from './_shared.js';

export async function deleteInvoice(id) {
  const res = await q(
    `DELETE FROM ${TB_INVOICES} WHERE inbound_id = $1 RETURNING inbound_id`,
    [id]
  );
  return res.rowCount > 0;
}

export default deleteInvoice;

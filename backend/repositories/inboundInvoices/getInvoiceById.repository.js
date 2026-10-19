// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ getInvoiceById.repository.js — CONSART ERP | Notas de Entrada           ║
// ║ Busca a nota de entrada pelo inbound_id                                  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  TB_INVOICES,
  q,
  invoiceResponse,
} from './_shared.js';

export async function getInvoiceById(id) {
  const inboundId = Number(id);
  if (!Number.isInteger(inboundId) || inboundId <= 0) return null;

  const res = await q(
    `SELECT * FROM ${TB_INVOICES} WHERE inbound_id = $1`,
    [inboundId]
  );
  return invoiceResponse(res.rows[0]);
}

export default getInvoiceById;

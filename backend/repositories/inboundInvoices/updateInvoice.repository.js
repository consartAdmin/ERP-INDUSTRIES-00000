// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ updateInvoice.repository.js — CONSART ERP | Notas de Entrada            ║
// ║ Atualização parcial do cabeçalho da NF-e de entrada                      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  TB_INVOICES,
  q,
  invoiceResponse,
} from './_shared.js';

import { getInvoiceById } from './getInvoiceById.repository.js';

export async function updateInvoice(id, payload) {
  const cols = [
    'access_key',
    'invoice_number',
    'series',
    'issuer',
    'recipient',
    'issue_date',
    'entry_date',
    'total_amount',
    'status',
    'stock_applied',
    'stock_applied_at',
    'xml_url',
    'danfe_url',
  ];

  const sets = [];
  const params = [];
  let i = 1;

  for (const c of cols) {
    if (payload[c] === undefined) continue;
    sets.push(`${c} = $${i++}`);
    params.push(payload[c]);
  }

  if (!sets.length) return getInvoiceById(id);

  const res = await q(
    `UPDATE ${TB_INVOICES} SET ${sets.join(', ')} WHERE inbound_id = $${i} RETURNING *`,
    [...params, id]
  );

  return invoiceResponse(res.rows[0]);
}

export default updateInvoice;

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ createInvoice.repository.js — CONSART ERP | Notas de Entrada            ║
// ║ Insere o cabeçalho da NF-e de entrada                                    ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  TB_INVOICES,
  q,
  invoiceResponse,
} from './_shared.js';

export async function createInvoice(payload) {
  const accessKey = String(payload.access_key || '').trim();
  if (!accessKey) throw new Error('access_key obrigatória');

  const res = await q(
    `
      INSERT INTO ${TB_INVOICES}
      (
        access_key,
        invoice_number,
        series,
        issuer,
        recipient,
        issue_date,
        entry_date,
        total_amount,
        status,
        stock_applied,
        stock_applied_at,
        xml_url,
        danfe_url
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `,
    [
      accessKey,
      payload.invoice_number ?? '0',
      payload.series ?? '0',
      payload.issuer?.slice(0, 18) ?? null,
      payload.recipient?.slice(0, 18) ?? null,
      payload.issue_date ?? null,
      payload.entry_date ?? null,
      Number(payload.total_amount ?? 0),
      payload.status ?? 'PENDING',
      payload.stock_applied ?? false,
      payload.stock_applied_at ?? null,
      payload.xml_url ?? null,
      payload.danfe_url ?? null,
    ]
  );

  return invoiceResponse(res.rows[0]);
}

export default createInvoice;

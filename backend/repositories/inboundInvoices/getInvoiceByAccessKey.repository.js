// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ getInvoiceByAccessKey.repository.js — CONSART ERP | Notas de Entrada    ║
// ║ Busca a nota de entrada pela chave de acesso (anti-duplicidade)          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  TB_INVOICES,
  q,
  invoiceResponse,
} from './_shared.js';

export async function getInvoiceByAccessKey(accessKey) {
  const res = await q(
    `SELECT * FROM ${TB_INVOICES} WHERE access_key = $1 LIMIT 1`,
    [String(accessKey || '').trim()]
  );

  return invoiceResponse(res.rows[0]);
}

export default getInvoiceByAccessKey;

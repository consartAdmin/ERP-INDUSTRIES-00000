// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ upsertInvoiceByAccessKey.repository.js — CONSART ERP | Notas de Entrada ║
// ║ Cria a nota apenas se a chave de acesso ainda não existir                ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { getInvoiceByAccessKey } from './getInvoiceByAccessKey.repository.js';
import { createInvoice } from './createInvoice.repository.js';

export async function upsertInvoiceByAccessKey(payload) {
  const existing = await getInvoiceByAccessKey(payload.access_key);

  if (existing) {
    const err = new Error('INVOICE_ALREADY_EXISTS');
    err.code = 'INVOICE_ALREADY_EXISTS';
    err.invoice = existing;
    throw err;
  }

  return createInvoice(payload);
}

export default upsertInvoiceByAccessKey;

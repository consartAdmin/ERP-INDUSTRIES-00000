// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ markInvoicePostedWithMovements.repository.js — CONSART ERP               ║
// ║ Registra as movimentações de ENTRADA e marca a nota como POSTED          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { registerInboundProductMovements } from './registerInboundProductMovements.repository.js';
import { markInvoicePosted } from './markInvoicePosted.repository.js';

export async function markInvoicePostedWithMovements(client, invoiceId, { userCtx = {} } = {}) {
  const movements = await registerInboundProductMovements(client, invoiceId, { userCtx });
  const invoice = await markInvoicePosted(client, invoiceId);

  return {
    invoice,
    movements,
  };
}

export default markInvoicePostedWithMovements;

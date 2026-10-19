// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ listInstallmentsByInvoice.repository.js — CONSART ERP | Notas de Entrada║
// ║ Parcelas da NF-e de entrada, ordenadas por número e vencimento           ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  TB_II_INSTALLMENTS,
  q,
  installmentResponse,
} from './_shared.js';

export async function listInstallmentsByInvoice(inboundId) {
  const res = await q(
    `SELECT *
       FROM ${TB_II_INSTALLMENTS}
      WHERE inbound_id = $1
      ORDER BY installment_number, due_date, inbound_installment_id`,
    [inboundId]
  );

  return res.rows.map(installmentResponse);
}

export default listInstallmentsByInvoice;

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ deleteInstallment.repository.js — CONSART ERP | Notas de Entrada        ║
// ║ Remove uma parcela da NF-e de entrada                                    ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  TB_II_INSTALLMENTS,
  q,
} from './_shared.js';

export async function deleteInstallment(id) {
  const res = await q(
    `DELETE FROM ${TB_II_INSTALLMENTS}
      WHERE inbound_installment_id = $1
      RETURNING inbound_installment_id`,
    [id]
  );
  return res.rowCount > 0;
}

export default deleteInstallment;

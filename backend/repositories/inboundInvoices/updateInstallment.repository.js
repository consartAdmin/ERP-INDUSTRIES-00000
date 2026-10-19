// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ updateInstallment.repository.js — CONSART ERP | Notas de Entrada        ║
// ║ Atualização parcial de uma parcela da NF-e de entrada                    ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  TB_II_INSTALLMENTS,
  q,
  installmentResponse,
} from './_shared.js';

export async function updateInstallment(id, payload) {
  const cols = [
    'installment_number',
    'installment_code',
    'due_date',
    'original_due_date',
    'amount',
    'paid_amount',
    'status',
    'is_paid',
    'paid_at',
    'accounts_payable_id',
  ];
  const sets = [];
  const params = [];
  let i = 1;

  for (const c of cols) {
    if (payload[c] === undefined) continue;
    sets.push(`${c} = $${i++}`);
    params.push(payload[c]);
  }

  if (!sets.length) {
    const r = await q(
      `SELECT * FROM ${TB_II_INSTALLMENTS} WHERE inbound_installment_id = $1`,
      [id]
    );
    return installmentResponse(r.rows[0]);
  }

  const res = await q(
    `UPDATE ${TB_II_INSTALLMENTS}
        SET ${sets.join(', ')}
      WHERE inbound_installment_id = $${i}
      RETURNING *`,
    [...params, id]
  );

  return installmentResponse(res.rows[0]);
}

export default updateInstallment;

// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsPayablePay.repository.js — pay (baixa parcial/total)       ║
// ║ Tabela: public."accountsPayable"                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_FULL } from './accountsPayable.constants.js';
import { q, toNumber } from './accountsPayable.utils.js';
import { getById } from './accountsPayableQuery.repository.js';

export async function pay(id, {
  payment_date,
  paid_increment,
  multa = 0,
  juros = 0,
  encargos = 0,
  observacao = ''
} = {}) {
  const current = await getById(id);
  if (!current) return null;

  const totalValue = toNumber(current.total_value, 0);
  const alreadyPaid = toNumber(current.amount_paid, 0);

  const inc = toNumber(paid_increment, 0);
  const m = toNumber(multa, 0);
  const j = toNumber(juros, 0);
  const e = toNumber(encargos, 0);

  const paidTotal = inc + m + j + e;
  const newPaid = alreadyPaid + paidTotal;
  const newBalance = Math.max(0, totalValue - newPaid);

  const newStatus = newBalance <= 0.009
    ? 'PAID'
    : String(current.status || 'PENDING').toUpperCase();

  const sql = `
    UPDATE ${TB_FULL}
    SET
      payment_date = $1,
      amount_paid  = $2,
      status       = $3,
      notes        = CASE
                      WHEN $4::text IS NULL OR $4::text = '' THEN notes
                      WHEN notes IS NULL OR notes = '' THEN $4::text
                      ELSE (notes || E'\\n' || $4::text)
                    END,
      updated_at   = NOW()
    WHERE id = $5
    RETURNING *
  `;

  const noteLine = observacao ? `Pagamento confirmado: ${observacao}` : '';

  const params = [
    payment_date || null,
    newPaid,
    newStatus,
    noteLine,
    id
  ];

  const res = await q(sql, params);
  if (!res.rowCount) return null;
  return res.rows[0];
}

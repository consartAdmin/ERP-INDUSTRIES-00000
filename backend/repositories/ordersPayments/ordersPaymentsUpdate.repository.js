// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersPaymentsUpdate.repository.js — updateOrderPayment            ║
// ║ Tabela: public."ordersPayments"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ORDERS_PAYMENTS } from './ordersPayments.constants.js';
import {
  normalizeMoney,
  normalizeInt,
  normalizeText,
  normalizeDate,
} from './ordersPayments.sanitizers.js';
import { rowToPayment } from './ordersPayments.mappers.js';

export async function updateOrderPayment(order_payment_id, payload = {}) {
  const data = {
    payment_method_id: normalizeInt(payload.payment_method_id),
    payment_method_name: normalizeText(payload.payment_method_name),
    amount: normalizeMoney(payload.amount),
    installments: normalizeInt(payload.installments),
    gap_one: normalizeInt(payload.gap_one),
    gap_two: normalizeInt(payload.gap_two),
    gap_three: normalizeInt(payload.gap_three),
    gap_four: normalizeInt(payload.gap_four),
    manual_due_date: normalizeDate(payload.manual_due_date),
  };

  if (data.amount <= 0) {
    throw new Error('amount deve ser maior que zero.');
  }

  const sql = `
    UPDATE ${TB_ORDERS_PAYMENTS}
       SET payment_method_id = $2,
           payment_method_name = $3,
           amount = $4,
           installments = $5,
           gap_one = $6,
           gap_two = $7,
           gap_three = $8,
           gap_four = $9,
           manual_due_date = $10
     WHERE order_payment_id = $1
     RETURNING *
  `;

  const params = [
    order_payment_id,
    data.payment_method_id,
    data.payment_method_name,
    data.amount,
    data.installments,
    data.gap_one,
    data.gap_two,
    data.gap_three,
    data.gap_four,
    data.manual_due_date,
  ];

  const { rows } = await pool.query(sql, params);
  return rowToPayment(rows[0]);
}

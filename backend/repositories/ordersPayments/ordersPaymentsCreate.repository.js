// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersPaymentsCreate.repository.js — createOrderPayment            ║
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

export async function createOrderPayment(payload = {}) {
  const data = {
    order_id: normalizeInt(payload.order_id),
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

  if (!data.order_id) {
    throw new Error('order_id é obrigatório.');
  }

  if (data.amount <= 0) {
    throw new Error('amount deve ser maior que zero.');
  }

  const sql = `
    INSERT INTO ${TB_ORDERS_PAYMENTS} (
      order_id,
      payment_method_id,
      payment_method_name,
      amount,
      installments,
      gap_one,
      gap_two,
      gap_three,
      gap_four,
      manual_due_date
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
  `;

  const params = [
    data.order_id,
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

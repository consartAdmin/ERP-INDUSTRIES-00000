// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersPaymentsRemove.repository.js — deleteOrderPayment            ║
// ║ Tabela: public."ordersPayments"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ORDERS_PAYMENTS } from './ordersPayments.constants.js';
import { rowToPayment } from './ordersPayments.mappers.js';

export async function deleteOrderPayment(order_payment_id) {
  const sql = `
    DELETE FROM ${TB_ORDERS_PAYMENTS}
     WHERE order_payment_id = $1
     RETURNING *
  `;

  const { rows } = await pool.query(sql, [order_payment_id]);
  return rowToPayment(rows[0]);
}

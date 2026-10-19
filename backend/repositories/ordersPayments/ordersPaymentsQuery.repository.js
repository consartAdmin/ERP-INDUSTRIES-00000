// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersPaymentsQuery.repository.js — list / getById                 ║
// ║ Tabela: public."ordersPayments"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ORDERS_PAYMENTS } from './ordersPayments.constants.js';
import { rowToPayment } from './ordersPayments.mappers.js';

export async function listOrdersPayments({ order_id = null, limit = 100, offset = 0 } = {}) {
  const params = [];
  const where = [];

  if (order_id) {
    params.push(order_id);
    where.push(`op.order_id = $${params.length}`);
  }

  params.push(limit);
  const limitParam = `$${params.length}`;

  params.push(offset);
  const offsetParam = `$${params.length}`;

  const sql = `
    SELECT op.*
      FROM ${TB_ORDERS_PAYMENTS} op
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY op.order_payment_id DESC
     LIMIT ${limitParam}
    OFFSET ${offsetParam}
  `;

  const { rows } = await pool.query(sql, params);
  return rows.map(rowToPayment);
}

export async function getOrderPaymentById(order_payment_id) {
  const sql = `
    SELECT *
      FROM ${TB_ORDERS_PAYMENTS}
     WHERE order_payment_id = $1
     LIMIT 1
  `;

  const { rows } = await pool.query(sql, [order_payment_id]);
  return rowToPayment(rows[0]);
}

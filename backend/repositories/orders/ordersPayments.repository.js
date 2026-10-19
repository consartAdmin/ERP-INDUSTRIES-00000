// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersPayments.repository.js — Pagamentos do pedido                  ║
// ║ Ponte order -> budget, vencimentos, payload NF-e                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ORDERS, TB_ORDERS_PAYMENTS, TB_INVOICES_ISSUED, TB_BUDGET_PAYMENTS, TB_PAYMENT_METHODS, TB_BUDGET_PAYMENT_INSTALLMENTS, TB_ORDERS_PAYMENT_INSTALLMENTS } from './orders.constants.js';
import { ensureTables } from './ordersSchema.repository.js';
import { reportOrdersError, parseFlexibleDate, toPgDate, round2 } from './orders.utils.js';
import { rowToBudgetPayment, rowToBudgetPaymentInstallment, buildPaymentLines, buildDuplicatasLines, buildPaymentObservationText } from './orders.mappers.js';

// ----------------------------------------------------------------------
// NEW: payments bridge order -> budget
// ----------------------------------------------------------------------
export async function listBudgetPaymentsByBudgetId(budgetId, client = pool) {
  const safeBudgetId = Number(budgetId);
  if (!Number.isFinite(safeBudgetId) || safeBudgetId <= 0) {
    return [];
  }

  const sql = `
  SELECT
    bp.budget_payment_id,
    bp.budget_id,
    bp.payment_method_id,
    bp.amount,
    bp.manual_due_date,
    bp.notes,
    bp.created_at,
    bp.updated_at,

    pm.name         AS payment_method_name,
    pm.type         AS payment_method_type,
    pm.installments AS installments,
    pm.gap_one      AS gap_one,
    pm.gap_two      AS gap_two,
    pm.gap_three    AS gap_three,
    pm.gap_four     AS gap_four

  FROM ${TB_BUDGET_PAYMENTS} bp
  LEFT JOIN ${TB_PAYMENT_METHODS} pm
    ON pm."paymentMethods_id" = bp.payment_method_id
  WHERE bp.budget_id = $1
  ORDER BY bp.budget_payment_id ASC
`;

  const { rows } = await client.query(sql, [safeBudgetId]);
  return rows.map(rowToBudgetPayment);
}

export async function listBudgetPaymentInstallmentsByBudgetId(budgetId, client = pool) {
  const safeBudgetId = Number(budgetId);
  if (!Number.isFinite(safeBudgetId) || safeBudgetId <= 0) {
    return [];
  }

  const sql = `
    SELECT
      bpi.budget_payment_installment_id,
      bpi.budget_payment_id,
      bpi.installment_number,
      bpi.due_date,
      bpi.amount
    FROM ${TB_BUDGET_PAYMENT_INSTALLMENTS} bpi
    INNER JOIN ${TB_BUDGET_PAYMENTS} bp
      ON bp.budget_payment_id = bpi.budget_payment_id
    WHERE bp.budget_id = $1
    ORDER BY bp.budget_payment_id ASC, bpi.installment_number ASC
  `;

  const { rows } = await client.query(sql, [safeBudgetId]);
  return rows.map(rowToBudgetPaymentInstallment);
}

export function addDaysToPgDate(baseDate, days = 0) {
  const d = parseFlexibleDate(baseDate);
  if (!d) return null;

  d.setDate(d.getDate() + Number(days || 0));

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

export async function resyncPaymentDueDatesFromNfeDate(orderId, clientArg = pool) {
  const safeOrderId = Number(orderId);
  if (!Number.isFinite(safeOrderId) || safeOrderId <= 0) {
    return { ok: false, error: 'order_id inválido' };
  }

  const { rows } = await clientArg.query(
    `
    SELECT
      o.order_id,
      o.issue_date,
      ii.issued_date AS nfe_issue_date,
      ii.issued_at   AS nfe_issue_datetime
    FROM ${TB_ORDERS} o
    LEFT JOIN LATERAL (
      SELECT i.issued_date, i.issued_at
      FROM ${TB_INVOICES_ISSUED} i
      WHERE i.order_id = o.order_id
      ORDER BY i.issued_at DESC NULLS LAST, i.invoice_id DESC
      LIMIT 1
    ) ii ON TRUE
    WHERE o.order_id = $1
    LIMIT 1
    `,
    [safeOrderId]
  );

  const order = rows?.[0];
  if (!order) return { ok: false, error: 'Pedido não encontrado' };

  const baseDate =
    order.nfe_issue_date ||
    order.nfe_issue_datetime ||
    order.issue_date;

  if (!baseDate) {
    return { ok: false, error: 'Pedido sem data base para vencimento' };
  }

  const paymentsRes = await clientArg.query(
    `
    SELECT
      order_payment_id,
      gap_one,
      gap_two,
      gap_three,
      gap_four
    FROM ${TB_ORDERS_PAYMENTS}
    WHERE order_id = $1
    ORDER BY order_payment_id ASC
    `,
    [safeOrderId]
  );

  let updated = 0;

  for (const payment of paymentsRes.rows || []) {
    const gaps = [
      payment.gap_one,
      payment.gap_two,
      payment.gap_three,
      payment.gap_four,
    ].map((v) => Number(v || 0));

    const instRes = await clientArg.query(
      `
      SELECT
        order_payment_installment_id,
        installment_number
      FROM ${TB_ORDERS_PAYMENT_INSTALLMENTS}
      WHERE order_payment_id = $1
      ORDER BY installment_number ASC
      `,
      [payment.order_payment_id]
    );

    for (const inst of instRes.rows || []) {
      const index = Math.max(Number(inst.installment_number || 1) - 1, 0);
      const gapDays = gaps[index] ?? gaps[0] ?? 0;
      const dueDate = addDaysToPgDate(baseDate, gapDays);

      if (!dueDate) continue;

      await clientArg.query(
        `
        UPDATE ${TB_ORDERS_PAYMENT_INSTALLMENTS}
        SET due_date = $1
        WHERE order_payment_installment_id = $2
        `,
        [dueDate, inst.order_payment_installment_id]
      );

      updated++;
    }
  }

  return {
    ok: true,
    order_id: safeOrderId,
    base_date: toPgDate(baseDate),
    updated,
  };
}

export async function getPaymentsByOrder(orderId) {
  await ensureTables();

  const client = await pool.connect();
  try {
    const paymentsRes = await client.query(`
      SELECT
        op.*,
        pm.name AS payment_method_name_join,
        pm.type AS payment_method_type,
        pm.installments AS payment_method_installments,
        pm.gap_one AS payment_method_gap_one,
        pm.gap_two AS payment_method_gap_two,
        pm.gap_three AS payment_method_gap_three,
        pm.gap_four AS payment_method_gap_four
      FROM ${TB_ORDERS_PAYMENTS} op
      LEFT JOIN ${TB_PAYMENT_METHODS} pm
        ON pm."paymentMethods_id" = op.payment_method_id
      WHERE op.order_id = $1
      ORDER BY op.order_payment_id
    `, [orderId]);

    const installmentsRes = await client.query(`
      SELECT opi.*
      FROM ${TB_ORDERS_PAYMENT_INSTALLMENTS} opi
      JOIN ${TB_ORDERS_PAYMENTS} op
        ON op.order_payment_id = opi.order_payment_id
      WHERE op.order_id = $1
      ORDER BY opi.installment_number
    `, [orderId]);

    const payments = (paymentsRes.rows || []).map((row) => ({
      ...row,
      payment_method_name:
        row.payment_method_name ||
        row.payment_method_name_join ||
        null,
      payment_method_type:
        row.payment_method_type || null,
      installments:
        row.installments ?? row.payment_method_installments ?? null,
      gap_one:
        row.gap_one ?? row.payment_method_gap_one ?? null,
      gap_two:
        row.gap_two ?? row.payment_method_gap_two ?? null,
      gap_three:
        row.gap_three ?? row.payment_method_gap_three ?? null,
      gap_four:
        row.gap_four ?? row.payment_method_gap_four ?? null,
    }));

    return {
      ok: true,
      order_id: Number(orderId),
      payments,
      installments: installmentsRes.rows,
    };
  } catch (err) {
    reportOrdersError('[ordersApi.getPaymentsByOrder] ERR:', err);
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}

export async function getNfePaymentPayload(orderId) {
  await ensureTables();

  const base = await getPaymentsByOrder(orderId);
  if (!base?.ok) return base;

  const payments = Array.isArray(base.payments) ? base.payments : [];
  const installments = Array.isArray(base.installments) ? base.installments : [];

  const payment_lines = buildPaymentLines(payments);
  const duplicatas = buildDuplicatasLines(payments, installments);
  const payment_observation = buildPaymentObservationText(payments, installments);

  const mainPayment = payments[0] || null;

  const paymentForm = mainPayment
    ? {
      payment_method_id: mainPayment.payment_method_id ?? null,
      payment_method_name: mainPayment.payment_method_name ?? null,
      payment_method_type: mainPayment.payment_method_type ?? null,
      amount: round2(mainPayment.amount),
      installments: mainPayment.installments != null ? Number(mainPayment.installments) : null,
      gap_one: mainPayment.gap_one != null ? Number(mainPayment.gap_one) : null,
      gap_two: mainPayment.gap_two != null ? Number(mainPayment.gap_two) : null,
      gap_three: mainPayment.gap_three != null ? Number(mainPayment.gap_three) : null,
      gap_four: mainPayment.gap_four != null ? Number(mainPayment.gap_four) : null,
      manual_due_date: mainPayment.manual_due_date ?? null,
    }
    : null;

  return {
    ok: true,
    order_id: base.order_id,

    paymentForm,

    payments,
    installments,

    payment_lines,
    duplicatas,
    payment_observation,
  };
}
export async function syncPaymentsFromBudgetToOrder({
  client,
  budgetId,
  orderId,
}) {
  await client.query(
    `DELETE FROM ${TB_ORDERS_PAYMENTS} WHERE order_id = $1`,
    [orderId]
  );

  const payments = await listBudgetPaymentsByBudgetId(budgetId, client);
  const installments = await listBudgetPaymentInstallmentsByBudgetId(budgetId, client);

  for (const payment of payments) {
    const insertPayment = await client.query(`
      INSERT INTO ${TB_ORDERS_PAYMENTS} (
      order_id,
      payment_method_id,
      payment_method_name,
      amount,
      manual_due_date,
      installments,
      gap_one, gap_two, gap_three, gap_four
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING order_payment_id
    `,
      [
        orderId,
        payment.payment_method_id,
        payment.payment_method_name,
        payment.amount,
        payment.manual_due_date,
        payment.installments,
        payment.gap_one,
        payment.gap_two,
        payment.gap_three,
        payment.gap_four,
      ]
    );

    const orderPaymentId = insertPayment.rows[0].order_payment_id;

    const relatedInstallments = installments.filter(
      (i) => i.budget_payment_id === payment.budget_payment_id
    );

    for (const inst of relatedInstallments) {
      await client.query(`
        INSERT INTO ${TB_ORDERS_PAYMENT_INSTALLMENTS} (
          order_payment_id,
          installment_number,
          due_date,
          amount
        )
        VALUES ($1,$2,$3,$4)
      `, [
        orderPaymentId,
        inst.installment_number,
        inst.due_date,
        inst.amount,
      ]);
    }
  }
}

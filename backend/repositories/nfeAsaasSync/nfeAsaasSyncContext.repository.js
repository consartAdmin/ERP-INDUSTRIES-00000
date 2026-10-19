// ╔══════════════════════════════════════════════════════════════════╗
// ║ nfeAsaasSyncContext.repository.js — contexto financeiro          ║
// ║ loadContext (pedido) e loadBudgetContext (orçamento)             ║
// ╚══════════════════════════════════════════════════════════════════╝

import { TB_ORDERS, TB_CUSTOMERS } from './nfeAsaasSync.constants.js';
import { cleanText, buildFinancialInstallments } from './nfeAsaasSync.utils.js';

// ============================================================================
// PEDIDO → CONTEXTO FINANCEIRO / ASAAS
// ============================================================================

export async function loadContext(client, orderId) {
  const orderResult = await client.query(
    `
      SELECT
        o.order_id,
        o.budget_id,
        o.customer_id,
        o.total_amount,
        o.operation_type_id,
        COALESCE(ii.issued_date, ii.issued_at::date, o.issue_date, CURRENT_DATE) AS issue_date,
        ii.nfe_number,
        ii.nfe_key,
        COALESCE(ot.generates_receivable, TRUE) AS generates_receivable,
        c.asaas_id,
        c.trade_name,
        c.legal_name
      FROM ${TB_ORDERS} o
      LEFT JOIN ${TB_CUSTOMERS} c
        ON c.customer_id = o.customer_id
      LEFT JOIN public."invoicesIssued" ii
        ON ii.order_id = o.order_id
       AND ii.source_type = 'ORDER'
      LEFT JOIN public."nfeOperationTypes" ot
        ON ot.operation_type_id = o.operation_type_id
      WHERE o.order_id = $1
      ORDER BY ii.invoice_id DESC NULLS LAST
      LIMIT 1
    `,
    [orderId],
  );

  const order = orderResult.rows[0];
  if (!order) throw new Error(`Pedido ${orderId} não encontrado.`);
  if (!order.budget_id) throw new Error(`Pedido ${orderId} não possui budget_id.`);
  if (!order.customer_id) throw new Error(`Pedido ${orderId} não possui customer_id.`);

  if (order.generates_receivable === false) {
    return { order, installments: [] };
  }

  const installmentsResult = await client.query(
    `
      SELECT
        bp.budget_payment_id,
        bp.payment_method_id,
        bp.amount AS payment_amount,
        bp.manual_due_date,
        bp.bank_account_id,
        bp.collection_provider,
        bp.boleto_mode,
        pm.name AS payment_method_name,
        pm.type AS payment_method_type,
        bpi.installment_number,
        bpi.amount AS installment_amount,
        bpi.due_date,
        bpi.status AS installment_status,
        bpi.paid_amount,
        bpi.paid_at
      FROM public."budgetsPayments" bp
      LEFT JOIN public."paymentMethods" pm
        ON pm."paymentMethods_id" = bp.payment_method_id
      LEFT JOIN public."budgetsPaymentInstallments" bpi
        ON bpi.budget_payment_id = bp.budget_payment_id
      WHERE bp.budget_id = $1
      ORDER BY
        bp.budget_payment_id ASC,
        bpi.installment_number ASC NULLS LAST,
        bpi.due_date ASC NULLS LAST
    `,
    [order.budget_id],
  );

  const installments = buildFinancialInstallments(installmentsResult.rows);

  if (installments.some((row) => row.automaticAsaas) && !cleanText(order.asaas_id)) {
    throw new Error(`Cliente ${order.customer_id} ainda não possui asaas_id para cobrança automática ASAAS.`);
  }

  return { order, installments };
}

// ============================================================================
// BUDGET → CONTEXTO FINANCEIRO / ASAAS
// ============================================================================

export async function loadBudgetContext(client, budgetId) {
  const id = Number(budgetId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('budgetId inválido.');
  }

  const budgetResult = await client.query(
    `
      SELECT
        b.budget_id,
        b.customer_id,
        b.total_amount,
        b.operation_type_id,
        COALESCE(ii.issued_date, ii.issued_at::date, b.issue_date, CURRENT_DATE) AS issue_date,
        ii.nfe_number,
        ii.nfe_key,
        COALESCE(ot.generates_receivable, TRUE) AS generates_receivable,
        c.asaas_id,
        c.trade_name,
        c.legal_name
      FROM public.budgets b
      LEFT JOIN public.customers c
        ON c.customer_id = b.customer_id
      LEFT JOIN public."invoicesIssued" ii
        ON ii.budget_id = b.budget_id
       AND ii.source_type = 'BUDGET'
      LEFT JOIN public."nfeOperationTypes" ot
        ON ot.operation_type_id = b.operation_type_id
      WHERE b.budget_id = $1
      ORDER BY ii.invoice_id DESC NULLS LAST
      LIMIT 1
    `,
    [id],
  );

  const budget = budgetResult.rows[0];

  if (!budget) {
    throw new Error(`Orçamento ${id} não encontrado.`);
  }

  if (!budget.customer_id) {
    throw new Error(`Orçamento ${id} não possui customer_id.`);
  }

  if (budget.generates_receivable === false) {
    return { budget, installments: [] };
  }

  const installmentsResult = await client.query(
    `
      SELECT
        bp.budget_payment_id,
        bp.payment_method_id,
        bp.amount AS payment_amount,
        bp.manual_due_date,
        bp.bank_account_id,
        bp.collection_provider,
        bp.boleto_mode,
        pm.name AS payment_method_name,
        pm.type AS payment_method_type,
        bpi.installment_number,
        bpi.amount AS installment_amount,
        bpi.due_date,
        bpi.status AS installment_status,
        bpi.paid_amount,
        bpi.paid_at
      FROM public."budgetsPayments" bp
      LEFT JOIN public."paymentMethods" pm
        ON pm."paymentMethods_id" = bp.payment_method_id
      LEFT JOIN public."budgetsPaymentInstallments" bpi
        ON bpi.budget_payment_id = bp.budget_payment_id
      WHERE bp.budget_id = $1
      ORDER BY
        bp.budget_payment_id ASC,
        bpi.installment_number ASC NULLS LAST,
        bpi.due_date ASC NULLS LAST
    `,
    [id],
  );

  const installments = buildFinancialInstallments(installmentsResult.rows);

  if (installments.some((row) => row.automaticAsaas) && !cleanText(budget.asaas_id)) {
    throw new Error(`Cliente ${budget.customer_id} ainda não possui asaas_id para cobrança automática ASAAS.`);
  }

  return { budget, installments };
}

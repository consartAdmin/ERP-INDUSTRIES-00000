// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableReports.sql.js — Filtros e CTE base (vendas x    ║
// ║ contas a receber x NF-e)                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_ORDERS, TB_RECEIVABLE, TB_INVOICES, TB_CUSTOMERS } from './accountsReceivableReports.constants.js';

export function filtersSql(filters = {}, startIndex = 1) {
  const clauses = [];
  const params = [];
  let index = startIndex;

  if (filters.fromDate) {
    clauses.push(`o.issue_date >= $${index++}`);
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    clauses.push(`o.issue_date <= $${index++}`);
    params.push(filters.toDate);
  }
  if (filters.customerId) {
    clauses.push(`o.customer_id = $${index++}`);
    params.push(filters.customerId);
  }
  if (filters.search) {
    clauses.push(`(
      o.customer_name ILIKE $${index}
      OR o.customer_tax_id ILIKE $${index}
      OR o.number::text ILIKE $${index}
      OR inv.nfe_number::text ILIKE $${index}
      OR ar.invoice_number ILIKE $${index}
      OR ar.document_number ILIKE $${index}
    )`);
    params.push(`%${filters.search}%`);
    index += 1;
  }
  if (filters.receivableStatus) {
    clauses.push(`UPPER(COALESCE(ar.status, 'SEM_CONTA')) = $${index++}`);
    params.push(String(filters.receivableStatus).toUpperCase());
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
    nextIndex: index,
  };
}

export function baseCte(whereSql, onlyDivergences = false) {
  return `
    WITH sales AS (
      SELECT
        o.order_id,
        o.number AS order_number,
        o.budget_id,
        o.issue_date,
        o.status AS order_status,
        o.customer_id,
        COALESCE(c.trade_name, o.customer_name) AS customer_name,
        o.customer_tax_id,
        COALESCE(o.total_amount, 0)::numeric AS sale_total,
        o.accounts_receivable_id,
        ar.invoice_number,
        ar.document_number,
        ar.issue_date AS receivable_issue_date,
        ar.due_date,
        ar.payment_date,
        ar.status AS receivable_status,
        COALESCE(ar.value, 0)::numeric AS receivable_value,
        COALESCE(ar.amount_paid, 0)::numeric AS received_value,
        GREATEST(COALESCE(ar.value, 0) - COALESCE(ar.amount_paid, 0), 0)::numeric AS balance,
        inv.invoice_id,
        inv.nfe_number,
        inv.nfe_key,
        inv.nfe_status,
        CASE
          WHEN o.accounts_receivable_id IS NULL OR ar.id IS NULL THEN 'SEM_CONTA'
          WHEN ABS(COALESCE(o.total_amount, 0) - COALESCE(ar.value, 0)) > 0.01 THEN 'DIVERGENTE'
          WHEN UPPER(COALESCE(ar.status, '')) = 'CANCELLED' THEN 'CANCELADA'
          WHEN COALESCE(ar.amount_paid, 0) >= COALESCE(ar.value, 0) AND COALESCE(ar.value, 0) > 0 THEN 'RECEBIDA'
          WHEN ar.due_date < CURRENT_DATE THEN 'VENCIDA'
          ELSE 'A_RECEBER'
        END AS reconciliation_status,
        (COALESCE(o.total_amount, 0) - COALESCE(ar.value, 0))::numeric AS difference
      FROM ${TB_ORDERS} o
      LEFT JOIN ${TB_RECEIVABLE} ar ON ar.id = o.accounts_receivable_id
      LEFT JOIN ${TB_CUSTOMERS} c ON c.customer_id = o.customer_id
      LEFT JOIN LATERAL (
        SELECT ii.*
        FROM ${TB_INVOICES} ii
        WHERE ii.order_id = o.order_id
           OR (ii.order_id IS NULL AND ii.budget_id = o.budget_id)
        ORDER BY ii.issued_at DESC NULLS LAST, ii.invoice_id DESC
        LIMIT 1
      ) inv ON TRUE
      ${whereSql}
    ), filtered AS (
      SELECT * FROM sales s
      ${onlyDivergences ? "WHERE s.reconciliation_status IN ('SEM_CONTA', 'DIVERGENTE')" : ''}
    )`;
}
